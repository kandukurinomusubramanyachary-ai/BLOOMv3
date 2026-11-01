import ExpoModulesCore
import AVFoundation
import MediaPipeTasksVision

public class BloomPoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BloomPose")
    AsyncFunction("requestPermission") { (promise: Promise) in
      switch AVCaptureDevice.authorizationStatus(for: .video) {
      case .authorized: promise.resolve(true)
      case .notDetermined: AVCaptureDevice.requestAccess(for: .video) { promise.resolve($0) }
      default: promise.resolve(false)
      }
    }
    View(BloomPoseView.self) {
      Events("onPose", "onReady", "onError")
      Prop("active") { (view: BloomPoseView, value: Bool) in view.setActive(value) }
      Prop("inferenceActive") { (view: BloomPoseView, value: Bool) in view.setInferenceActive(value) }
    }
  }
}

final class BloomPoseView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  let onPose = EventDispatcher()
  let onReady = EventDispatcher()
  let onError = EventDispatcher()
  private let session = AVCaptureSession()
  private let queue = DispatchQueue(label: "bloom.pose.camera", qos: .userInitiated)
  private var preview: AVCaptureVideoPreviewLayer?
  private var detector: PoseLandmarker?
  private var requested = false
  private var processing = true
  private var generation = 0
  private var lastFrame = 0
  private var processingGeneration = 0
  private var observers: [NSObjectProtocol] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.setActive(false) })
    observers.append(NotificationCenter.default.addObserver(forName: .AVCaptureSessionWasInterrupted, object: session, queue: .main) { [weak self] _ in self?.setActive(false); self?.onError(["code":"camera_interrupted"]) })
    observers.append(NotificationCenter.default.addObserver(forName: .AVCaptureSessionRuntimeError, object: session, queue: .main) { [weak self] _ in self?.setActive(false); self?.onError(["code":"camera_unavailable"]) })
  }
  deinit { observers.forEach(NotificationCenter.default.removeObserver) }
  override func layoutSubviews() { super.layoutSubviews(); preview?.frame = bounds }
  override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { setActive(false) } }
  func setInferenceActive(_ value: Bool) { queue.async { [weak self] in self?.processing = value } }
  func setActive(_ value: Bool) {
    requested = value; generation += 1
    let version = generation
    if !value {
      preview?.removeFromSuperlayer(); preview = nil
      queue.async { [weak self] in
        guard let self else { return }
        if self.session.isRunning { self.session.stopRunning() }
        self.session.inputs.forEach(self.session.removeInput)
        self.session.outputs.forEach(self.session.removeOutput)
        self.detector = nil
      }
      return
    }
    guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else { onError(["code":"permission"]); return }
    let layer = AVCaptureVideoPreviewLayer(session: session)
    layer.videoGravity = .resizeAspect
    layer.frame = bounds
    self.layer.addSublayer(layer); preview = layer
    queue.async { [weak self] in
      guard let self else { return }
      do {
        if self.session.isRunning { self.session.stopRunning() }
        self.session.inputs.forEach(self.session.removeInput)
        self.session.outputs.forEach(self.session.removeOutput)
        let modelBundle = Bundle(for: BloomPoseView.self)
        let bundleURL = modelBundle.url(forResource: "BloomPoseModels", withExtension: "bundle") ?? Bundle.main.url(forResource: "BloomPoseModels", withExtension: "bundle")
        guard let bundleURL, let model = Bundle(url: bundleURL)?.path(forResource: "pose_landmarker_lite", ofType: "task"),
              let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else { throw NSError(domain:"bloom.pose",code:1) }
        let options = PoseLandmarkerOptions()
        options.baseOptions.modelAssetPath = model
        options.runningMode = .video; options.numPoses = 2
        options.minPoseDetectionConfidence = 0.5; options.minPosePresenceConfidence = 0.5; options.minTrackingConfidence = 0.5
        self.detector = try PoseLandmarker(options: options)
        self.session.beginConfiguration()
        self.session.sessionPreset = .vga640x480
        let input = try AVCaptureDeviceInput(device: camera)
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.setSampleBufferDelegate(self, queue: self.queue)
        guard self.session.canAddInput(input), self.session.canAddOutput(output) else { self.session.commitConfiguration(); throw NSError(domain:"bloom.pose",code:2) }
        self.session.addInput(input); self.session.addOutput(output)
        if let connection = output.connection(with: .video) {
          if connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
          if connection.isVideoMirroringSupported { connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = false }
        }
        self.session.commitConfiguration()
        self.lastFrame = 0
        self.processingGeneration = version
        self.session.startRunning()
        DispatchQueue.main.async { [weak self] in
          guard let self, self.generation == version, self.requested else { return }
          if let connection = layer.connection {
            if connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
            if connection.isVideoMirroringSupported { connection.automaticallyAdjustsVideoMirroring = false; connection.isVideoMirrored = true }
          }
          self.onReady([:])
        }
      } catch { DispatchQueue.main.async { [weak self] in if self?.generation == version { self?.setActive(false); self?.onError(["code":"pose_runtime_unavailable"]) } } }
    }
  }
  func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let version = processingGeneration
    let ts = Int(ProcessInfo.processInfo.systemUptime * 1000)
    guard processing, ts - lastFrame >= 100, let detector, let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
    lastFrame = ts
    do {
      let image = try MPImage(sampleBuffer: sampleBuffer, orientation: .up)
      let result = try detector.detect(videoFrame: image, timestampInMilliseconds: ts)
      let width = CVPixelBufferGetWidth(buffer), height = CVPixelBufferGetHeight(buffer)
      let poses = result.landmarks.map { pose in pose.enumerated().map { (index, p) -> [String:Any] in
        ["id":index,"x":p.x,"y":p.y,"z":p.z,"visibility":p.visibility?.doubleValue ?? 0,"presence":p.presence?.doubleValue ?? 0]
      } }
      DispatchQueue.main.async { [weak self] in guard let self, self.requested, self.generation == version else { return }; self.onPose(["poses":poses,"ts":ts,"sourceWidth":width,"sourceHeight":height,"mirrored":true]) }
    } catch { DispatchQueue.main.async { [weak self] in self?.setActive(false); self?.onError(["code":"pose_processing_failed"]) } }
  }
}

package bloom.pose

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView
import expo.modules.kotlin.viewevent.EventDispatcher
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

class BloomPoseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BloomPose")
    View(BloomPoseView::class) {
      Events("onPose", "onReady", "onError")
      Prop("active") { view: BloomPoseView, active: Boolean -> view.setActive(active) }
      Prop("inferenceActive") { view: BloomPoseView, active: Boolean -> view.inferenceActive = active }
    }
  }
}

class BloomPoseView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onPose by EventDispatcher()
  val onReady by EventDispatcher()
  val onError by EventDispatcher()
  private val preview = PreviewView(context).apply { scaleType = PreviewView.ScaleType.FIT_CENTER }
  companion object { private val worker = Executors.newSingleThreadExecutor() }
  private val revision = AtomicInteger(0)
  private var provider: ProcessCameraProvider? = null
  private var cameraPreview: Preview? = null
  private var analysis: ImageAnalysis? = null
  private var detector: PoseLandmarker? = null
  private var requested = false
  @Volatile var inferenceActive = true
  private var lastFrame = 0L
  init { addView(preview, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)) }
  fun setActive(active: Boolean) {
    requested = active
    if (active && isAttachedToWindow) start() else stop()
  }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); if (requested) start() }
  override fun onDetachedFromWindow() { stop(); super.onDetachedFromWindow() }
  private fun error(code: String) { post { onError(mapOf("code" to code)) } }
  private fun start() {
    if (analysis != null) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) { error("permission"); return }
    val owner = appContext.currentActivity as? LifecycleOwner ?: run { error("camera_unavailable"); return }
    val version = revision.incrementAndGet()
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      if (!requested || !isAttachedToWindow || version != revision.get()) return@addListener
      try {
        val source = future.get()
        val displayRotation = display?.rotation ?: 0
        val camera = Preview.Builder().setTargetRotation(displayRotation).build()
        camera.setSurfaceProvider(preview.surfaceProvider)
        val analyzer = ImageAnalysis.Builder().setTargetResolution(android.util.Size(640, 480))
          .setTargetRotation(displayRotation).setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
        provider = source; cameraPreview = camera; analysis = analyzer
        worker.execute {
          try {
            if (version == revision.get()) {
              detector = PoseLandmarker.createFromOptions(context, PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath("pose_landmarker_lite.task").build())
                .setRunningMode(RunningMode.VIDEO).setNumPoses(2).setMinPoseDetectionConfidence(0.5f)
                .setMinPosePresenceConfidence(0.5f).setMinTrackingConfidence(0.5f).build())
              lastFrame = 0L
              post { if (version == revision.get()) onReady(emptyMap<String, Any>()) }
            }
          } catch (_: Exception) { if (version == revision.get()) error("pose_runtime_unavailable") }
        }
        analyzer.setAnalyzer(worker) { image ->
          var bitmap: Bitmap? = null
          var rotated: Bitmap? = null
          try {
            val now = SystemClock.uptimeMillis()
            val model = detector
            if (version == revision.get() && inferenceActive && model != null && now - lastFrame >= 100L) {
              lastFrame = now
              val plane = image.planes[0]
              val rowPixels = plane.rowStride / plane.pixelStride
              bitmap = Bitmap.createBitmap(rowPixels, image.height, Bitmap.Config.ARGB_8888)
              plane.buffer.rewind(); bitmap.copyPixelsFromBuffer(plane.buffer)
              val cropped = Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
              rotated = Bitmap.createBitmap(cropped, 0, 0, cropped.width, cropped.height, Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }, true)
              if (cropped !== bitmap && cropped !== rotated) cropped.recycle()
              val input = BitmapImageBuilder(rotated).build()
              try {
                val result = model.detectForVideo(input, now)
                val width = rotated.width; val height = rotated.height
                val poses = result.landmarks().map { pose -> pose.mapIndexed { index, p -> mapOf("id" to index, "x" to p.x(), "y" to p.y(), "z" to p.z(), "visibility" to p.visibility().orElse(0f), "presence" to p.presence().orElse(0f)) } }
                post { if (version == revision.get() && requested) onPose(mapOf("poses" to poses, "ts" to now.toDouble(), "sourceWidth" to width, "sourceHeight" to height, "mirrored" to true)) }
              } finally { input.close() }
            }
          } catch (_: Exception) { if (version == revision.get()) error("pose_processing_failed") }
          finally { if (rotated !== bitmap) rotated?.recycle(); bitmap?.recycle(); image.close() }
        }
        source.bindToLifecycle(owner, CameraSelector.DEFAULT_FRONT_CAMERA, camera, analyzer)
      } catch (_: Exception) { stop(); error("camera_unavailable") }
    }, ContextCompat.getMainExecutor(context))
  }
  private fun stop() {
    revision.incrementAndGet()
    analysis?.clearAnalyzer()
    val useCases = listOfNotNull(cameraPreview, analysis)
    if (useCases.isNotEmpty()) provider?.unbind(*useCases.toTypedArray())
    analysis = null; cameraPreview = null; provider = null
    worker.execute { detector?.close(); detector = null }
  }
}

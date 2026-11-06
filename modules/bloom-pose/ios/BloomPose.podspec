Pod::Spec.new do |s|
  s.name = 'BloomPose'
  s.version = '0.1.0'
  s.summary = 'Private on-device Bloom pose camera'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'Bloom'
  s.homepage = 'https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3'
  s.platform = :ios, '16.4'
  s.source = { :git => s.homepage }
  s.static_framework = true
  s.swift_version = '5.9'
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '0.10.35'
  s.source_files = '**/*.swift'
  s.resource_bundles = { 'BloomPoseModels' => 'Resources/pose_landmarker_lite.task' }
end

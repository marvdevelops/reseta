Pod::Spec.new do |s|
  s.name           = 'ResetaVision'
  s.version        = '1.0.0'
  s.summary        = 'Apple Vision line reading and the VisionKit document scanner for Reseta'
  s.description    = s.summary
  s.author         = 'Reseta'
  s.homepage       = 'https://github.com/reseta'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'VisionKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end

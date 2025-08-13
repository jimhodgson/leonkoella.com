# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = "koella"
  spec.version       = "0.1.0"
  spec.authors       = ["James Hodgson"]
  spec.email         = ["jim@jimhodgson.com"]

  spec.summary       = "A lightweight theme for a fine art painter."
  spec.homepage      = "http://leonkoella.com"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0").select { |f| f.match(%r!^(assets|_data|_layouts|_includes|_sass|LICENSE|README|_config\.yml)!i) }

  spec.add_runtime_dependency "jekyll", "~> 4.4"
end

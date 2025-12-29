import { parseGemfile, parseGemfileLock } from '../../src/parsers/ruby';
import { ParsedDependencies } from '../../src/types';

describe('Ruby Parsers', () => {
  describe('parseGemfile', () => {
    it('should parse gem declarations', () => {
      const content = `
source 'https://rubygems.org'

gem 'rails', '~> 7.0.0'
gem 'pg', '>= 1.1'
gem 'puma'

group :development, :test do
  gem 'rspec-rails', '~> 6.0.0'
  gem 'factory_bot_rails'
end
`;

      const result = parseGemfile(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('rails')).toBe('~> 7.0.0');
      expect(prodDeps?.dependencies.get('pg')).toBe('>= 1.1');
      expect(prodDeps?.dependencies.get('puma')).toBe('*');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('rspec-rails')).toBe('~> 6.0.0');
      expect(devDeps?.dependencies.get('factory_bot_rails')).toBe('*');
    });

    it('should skip comments', () => {
      const content = `
# This is a comment
gem 'rails', '~> 7.0.0'
`;

      const result = parseGemfile(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.size).toBe(1);
    });
  });

  describe('parseGemfileLock', () => {
    it('should parse Gemfile.lock format', () => {
      const content = `
GEM
  remote: https://rubygems.org/
  specs:
    actioncable (7.0.8)
      actionpack (= 7.0.8)
    actionpack (7.0.8)
      activesupport (= 7.0.8)
    rails (7.0.8)

PLATFORMS
  ruby

DEPENDENCIES
  rails (~> 7.0.0)

BUNDLED WITH
   2.4.0
`;

      const result = parseGemfileLock(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('actioncable')).toBe('7.0.8');
      expect(result[0].dependencies.get('actionpack')).toBe('7.0.8');
      expect(result[0].dependencies.get('rails')).toBe('7.0.8');
    });
  });
});

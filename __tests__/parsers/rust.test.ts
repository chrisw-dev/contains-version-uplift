import { parseCargoToml, parseCargoLock } from '../../src/parsers/rust';
import { ParsedDependencies } from '../../src/types';

describe('Rust Parsers', () => {
  describe('parseCargoToml', () => {
    it('should parse dependencies', () => {
      const content = `
[package]
name = "myproject"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.35", features = ["full"] }

[dev-dependencies]
criterion = "0.5"

[build-dependencies]
cc = "1.0"
`;

      const result = parseCargoToml(content);

      expect(result).toHaveLength(3);
      
      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('serde')).toBe('1.0');
      expect(prodDeps?.dependencies.get('tokio')).toBe('1.35');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('criterion')).toBe('0.5');

      const buildDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'build');
      expect(buildDeps?.dependencies.get('cc')).toBe('1.0');
    });

    it('should handle complex version specifications', () => {
      const content = `
[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.35", optional = true }
`;

      const result = parseCargoToml(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('serde')).toBe('1.0');
      expect(result[0].dependencies.get('tokio')).toBe('1.35');
    });
  });

  describe('parseCargoLock', () => {
    it('should parse Cargo.lock format', () => {
      const content = `
[[package]]
name = "serde"
version = "1.0.193"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "tokio"
version = "1.35.1"
source = "registry+https://github.com/rust-lang/crates.io-index"
`;

      const result = parseCargoLock(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('serde')).toBe('1.0.193');
      expect(result[0].dependencies.get('tokio')).toBe('1.35.1');
    });
  });
});

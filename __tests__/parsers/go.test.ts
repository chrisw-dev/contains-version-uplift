import { parseGoMod, parseGoSum } from '../../src/parsers/go';

describe('Go Parsers', () => {
  describe('parseGoMod', () => {
    it('should parse require block', () => {
      const content = `
module github.com/example/mymodule

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4
	golang.org/x/text v0.14.0 // indirect
)
`;

      const result = parseGoMod(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('github.com/gin-gonic/gin')).toBe('v1.9.1');
      expect(result[0].dependencies.get('github.com/stretchr/testify')).toBe('v1.8.4');
      // Indirect dependencies should be skipped
      expect(result[0].dependencies.has('golang.org/x/text')).toBe(false);
    });

    it('should parse single require statements', () => {
      const content = `
module github.com/example/mymodule

go 1.21

require github.com/gin-gonic/gin v1.9.1
require github.com/stretchr/testify v1.8.4
`;

      const result = parseGoMod(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('github.com/gin-gonic/gin')).toBe('v1.9.1');
      expect(result[0].dependencies.get('github.com/stretchr/testify')).toBe('v1.8.4');
    });

    it('should skip comments', () => {
      const content = `
module github.com/example/mymodule

// This is a comment
require github.com/gin-gonic/gin v1.9.1
`;

      const result = parseGoMod(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.size).toBe(1);
    });
  });

  describe('parseGoSum', () => {
    it('should parse go.sum format', () => {
      const content = `
github.com/gin-gonic/gin v1.9.1 h1:4idEAncQnU5cB7BeOkPtxjfCSye0AAm1R0RVIqJ+Jmg=
github.com/gin-gonic/gin v1.9.1/go.mod h1:hPrL0YrVViAhK1+kjUYWIiNGOH+jAFX9C9v5hB7tN3A=
github.com/stretchr/testify v1.8.4 h1:CcVxjf3Q8PM0mHUKJCdn+eZZtm5yQzsRs2+AEW/h1jQ=
github.com/stretchr/testify v1.8.4/go.mod h1:sz/lmYIOXD/1dqDmKjjqLyZ2RngseejIcXlSw2iwfAo=
`;

      const result = parseGoSum(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('github.com/gin-gonic/gin')).toBe('v1.9.1');
      expect(result[0].dependencies.get('github.com/stretchr/testify')).toBe('v1.8.4');
    });
  });
});

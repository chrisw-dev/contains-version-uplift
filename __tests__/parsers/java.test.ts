import { parsePomXml, parseBuildGradle } from '../../src/parsers/java';
import { ParsedDependencies } from '../../src/types';

describe('Java Parsers', () => {
  describe('parsePomXml', () => {
    it('should parse Maven dependencies', () => {
      const content = `
<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
      <version>3.2.0</version>
    </dependency>
    <dependency>
      <groupId>junit</groupId>
      <artifactId>junit</artifactId>
      <version>4.13.2</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
</project>
`;

      const result = parsePomXml(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('org.springframework.boot:spring-boot-starter-web')).toBe(
        '3.2.0'
      );

      const testDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'test');
      expect(testDeps?.dependencies.get('junit:junit')).toBe('4.13.2');
    });

    it('should skip property references', () => {
      const content = `
<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.example</groupId>
      <artifactId>my-lib</artifactId>
      <version>\${project.version}</version>
    </dependency>
  </dependencies>
</project>
`;

      const result = parsePomXml(content);
      expect(result).toEqual([]);
    });

    it('should parse dependencyManagement', () => {
      const content = `
<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>3.2.0</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>
`;

      const result = parsePomXml(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('org.springframework.boot:spring-boot-dependencies')).toBe(
        '3.2.0'
      );
    });
  });

  describe('parseBuildGradle', () => {
    it('should parse Gradle Groovy DSL', () => {
      const content = `
plugins {
    id 'java'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web:3.2.0'
    testImplementation 'junit:junit:4.13.2'
}
`;

      const result = parseBuildGradle(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('org.springframework.boot:spring-boot-starter-web')).toBe(
        '3.2.0'
      );

      const testDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'test');
      expect(testDeps?.dependencies.get('junit:junit')).toBe('4.13.2');
    });

    it('should parse Gradle Kotlin DSL', () => {
      const content = `
plugins {
    kotlin("jvm")
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web:3.2.0")
    testImplementation("junit:junit:4.13.2")
}
`;

      const result = parseBuildGradle(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('org.springframework.boot:spring-boot-starter-web')).toBe(
        '3.2.0'
      );
    });
  });
});

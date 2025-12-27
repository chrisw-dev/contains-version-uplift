import { parseCsproj, parsePackagesConfig } from '../../src/parsers/dotnet';

describe('.NET Parsers', () => {
  describe('parseCsproj', () => {
    it('should parse PackageReference format', () => {
      const content = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="Microsoft.Extensions.Logging" Version="8.0.0" />
  </ItemGroup>
</Project>
`;

      const result = parseCsproj(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('Newtonsoft.Json')).toBe('13.0.3');
      expect(result[0].dependencies.get('Microsoft.Extensions.Logging')).toBe('8.0.0');
    });

    it('should handle empty project', () => {
      const content = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
</Project>
`;

      const result = parseCsproj(content);
      expect(result).toEqual([]);
    });
  });

  describe('parsePackagesConfig', () => {
    it('should parse packages.config format', () => {
      const content = `
<?xml version="1.0" encoding="utf-8"?>
<packages>
  <package id="Newtonsoft.Json" version="13.0.3" targetFramework="net48" />
  <package id="Microsoft.Extensions.Logging" version="8.0.0" targetFramework="net48" />
</packages>
`;

      const result = parsePackagesConfig(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('Newtonsoft.Json')).toBe('13.0.3');
      expect(result[0].dependencies.get('Microsoft.Extensions.Logging')).toBe('8.0.0');
    });
  });
});

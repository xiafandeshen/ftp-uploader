// tests/units/file-filter.test.js
const micromatch = require("micromatch")

describe("文件过滤规则测试", () => {
  describe("include规则", () => {
    const includePatterns = [
      "**/*.html",
      "**/*.htm",
      "important/**/*",
      "index.html",
    ]

    const testCases = [
      { file: "index.html", expected: true, desc: "首页应该匹配" },
      { file: "about/index.html", expected: true, desc: "子目录HTML应该匹配" },
      { file: "page.htm", expected: true, desc: "HTM文件应该匹配" },
      {
        file: "important/config.json",
        expected: true,
        desc: "重要目录文件应该匹配",
      },
      { file: "css/style.css", expected: false, desc: "CSS文件不应该匹配" },
      { file: "js/app.js", expected: false, desc: "JS文件不应该匹配" },
    ]

    testCases.forEach(({ file, expected, desc }) => {
      test(desc, () => {
        const result = micromatch.isMatch(file, includePatterns)
        expect(result).toBe(expected)
      })
    })
  })

  describe("exclude规则", () => {
    const excludePatterns = [
      "**/*.map",
      ".git/**",
      ".gitignore",
      "**/.DS_Store",
      "node_modules/**",
    ]

    const testCases = [
      { file: "js/app.js.map", expected: true, desc: "Source map应该被排除" },
      { file: ".git/config", expected: true, desc: "Git目录应该被排除" },
      { file: ".gitignore", expected: true, desc: "Git忽略文件应该被排除" },
      {
        file: "images/.DS_Store",
        expected: true,
        desc: "macOS系统文件应该被排除",
      },
      {
        file: "node_modules/express/index.js",
        expected: true,
        desc: "node_modules应该被排除",
      },
      { file: "index.html", expected: false, desc: "HTML文件不应该被排除" },
      { file: "css/style.css", expected: false, desc: "CSS文件不应该被排除" },
    ]

    testCases.forEach(({ file, expected, desc }) => {
      test(desc, () => {
        const result = micromatch.isMatch(file, excludePatterns)
        expect(result).toBe(expected)
      })
    })
  })

  describe("复杂模式匹配", () => {
    test("应该正确处理包含和排除的组合", () => {
      // 注意：micromatch 的取反模式需要特殊处理
      // 正确用法是先用 include 匹配，再用 exclude 过滤
      const patterns = ["**/*.js"]
      const excludePatterns = ["**/*.min.js"]

      expect(micromatch.isMatch("app.js", patterns)).toBe(true)
      expect(
        micromatch.isMatch("app.js", patterns) &&
          !micromatch.isMatch("app.js", excludePatterns)
      ).toBe(true)

      expect(micromatch.isMatch("app.min.js", patterns)).toBe(true)
      expect(
        micromatch.isMatch("app.min.js", patterns) &&
          !micromatch.isMatch("app.min.js", excludePatterns)
      ).toBe(false)
    })

    test("应该支持扩展名组合", () => {
      const patterns = ["**/*.{html,css,js}"]

      expect(micromatch.isMatch("index.html", patterns)).toBe(true)
      expect(micromatch.isMatch("style.css", patterns)).toBe(true)
      expect(micromatch.isMatch("app.js", patterns)).toBe(true)
      expect(micromatch.isMatch("image.png", patterns)).toBe(false)
    })

    test("应该支持目录深度", () => {
      const patterns = ["a/b/**/*"]

      expect(micromatch.isMatch("a/b/c/file.txt", patterns)).toBe(true)
      expect(micromatch.isMatch("a/b/file.txt", patterns)).toBe(true)
      expect(micromatch.isMatch("a/c/file.txt", patterns)).toBe(false)
    })

    test("应该正确处理多个排除规则", () => {
      const patterns = ["**/*"]
      const excludePatterns = ["**/*.map", "**/*.log", ".git/**"]

      const shouldInclude = (file) => {
        return (
          micromatch.isMatch(file, patterns) &&
          !micromatch.isMatch(file, excludePatterns)
        )
      }

      expect(shouldInclude("index.html")).toBe(true)
      expect(shouldInclude("js/app.js")).toBe(true)
      expect(shouldInclude("js/app.js.map")).toBe(false)
      expect(shouldInclude(".git/config")).toBe(false)
    })
  })
})

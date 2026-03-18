// tests/units/ftp-uploader.test.js - 完整修复版本
const FtpUploader = require("../../lib/index")
const mock = require("mock-fs")
const micromatch = require("micromatch")

// 模拟ftp客户端
jest.mock("basic-ftp", () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      access: jest.fn().mockResolvedValue(true),
      close: jest.fn(),
      list: jest.fn().mockResolvedValue([]),
      ensureDir: jest.fn().mockResolvedValue(true),
      uploadFrom: jest.fn().mockResolvedValue(true),
      ftp: { verbose: false, log: jest.fn() },
    })),
  }
})

describe("FtpUploader", () => {
  let uploader
  const mockConfig = {
    host: "test.com",
    port: 21,
    username: "test",
    password: "test",
    localDir: "/test/local",
    remoteDir: "/test/remote",
    include: [],
    exclude: [],
    debug: false,
    recursive: true,
  }

  beforeEach(() => {
    uploader = new FtpUploader({ ...mockConfig })
    jest.clearAllMocks()
  })

  afterEach(() => {
    mock.restore()
  })

  describe("构造函数", () => {
    test("应该正确初始化配置", () => {
      expect(uploader.config).toEqual(mockConfig)
      expect(uploader.client).toBeDefined()
      expect(uploader.client.ftp.verbose).toBe(false)
    })

    test("应该禁用FTP详细日志", () => {
      expect(uploader.client.ftp.log).toBeDefined()
      expect(typeof uploader.client.ftp.log).toBe("function")
    })
  })

  describe("connect方法", () => {
    test("应该成功连接到FTP服务器", async () => {
      const result = await uploader.connect()
      expect(result).toBe(true)
      expect(uploader.client.access).toHaveBeenCalledWith({
        host: "test.com",
        port: 21,
        user: "test",
        password: "test",
        secure: false,
        secureOptions: undefined,
      })
    })

    test("应该支持FTPS连接", async () => {
      uploader.config.ftps = true
      const result = await uploader.connect()
      expect(result).toBe(true)
      expect(uploader.client.access).toHaveBeenCalledWith({
        host: "test.com",
        port: 21,
        user: "test",
        password: "test",
        secure: true,
        secureOptions: { rejectUnauthorized: false },
      })
    })

    test("连接失败时应返回false", async () => {
      uploader.client.access.mockRejectedValue(new Error("连接失败"))
      const result = await uploader.connect()
      expect(result).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe("getAllLocalFiles方法", () => {
    afterEach(() => {
      mock.restore()
    })

    test("应该递归获取所有本地文件", () => {
      mock({
        "/test/local": {
          "index.html": "<h1>Hello</h1>",
          "about.html": "<h1>About</h1>",
          css: {
            "style.css": "body { color: red; }",
          },
          js: {
            "app.js": 'console.log("app")',
            "app.js.map": '{"version":3}',
          },
          ".gitignore": "node_modules/",
          images: {
            "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          },
        },
      })

      const files = uploader.getAllLocalFiles("/test/local")

      expect(files).toHaveLength(7)

      const filePaths = files.map((f) => f.relativePath).sort()
      expect(filePaths).toEqual([
        ".gitignore",
        "about.html",
        "css/style.css",
        "images/logo.png",
        "index.html",
        "js/app.js",
        "js/app.js.map",
      ])
    })

    test("应该正确处理空目录", () => {
      mock({
        "/test/empty": {},
      })

      const files = uploader.getAllLocalFiles("/test/empty")
      expect(files).toHaveLength(0)
    })

    test("应该正确处理单文件", () => {
      const singleDirConfig = {
        ...mockConfig,
        localDir: "/test/single",
      }
      uploader = new FtpUploader(singleDirConfig)

      mock({
        "/test/single": {
          "file.txt": "content",
        },
      })

      const files = uploader.getAllLocalFiles("/test/single")
      expect(files).toHaveLength(1)
      expect(files[0].relativePath).toBe("file.txt")
      expect(files[0].name).toBe("file.txt")
      expect(files[0]).toHaveProperty("size")
    })

    test("recursive为false时不应该递归子目录", () => {
      uploader.config.recursive = false

      mock({
        "/test/local": {
          "index.html": "<h1>Hello</h1>",
          css: {
            "style.css": "body { color: red; }",
          },
        },
      })

      const files = uploader.getAllLocalFiles("/test/local")

      expect(files).toHaveLength(1)
      expect(files[0].relativePath).toBe("index.html")
    })

    test("应该应用exclude规则过滤文件", () => {
      uploader = new FtpUploader({
        ...mockConfig,
        exclude: ["**/*.map", ".gitignore"],
      })

      mock({
        "/test/local": {
          "index.html": "<h1>Hello</h1>",
          js: {
            "app.js": 'console.log("app")',
            "app.js.map": '{"version":3}',
          },
          ".gitignore": "node_modules/",
          css: {
            "style.css": "body { color: red; }",
          },
        },
      })

      const files = uploader.getAllLocalFiles("/test/local")

      const filePaths = files.map((f) => f.relativePath).sort()

      expect(filePaths).not.toContain("js/app.js.map")
      expect(filePaths).not.toContain(".gitignore")
      expect(filePaths).toContain("index.html")
      expect(filePaths).toContain("js/app.js")
      expect(filePaths).toContain("css/style.css")
      expect(files).toHaveLength(3)
    })

    test("exclude规则应该支持通配符", () => {
      uploader = new FtpUploader({
        ...mockConfig,
        exclude: ["**/*.{map,png}", "**/.git*"],
      })

      mock({
        "/test/local": {
          "index.html": "<h1>Hello</h1>",
          js: {
            "app.js": 'console.log("app")',
            "app.js.map": '{"version":3}',
          },
          ".gitignore": "node_modules/",
          images: {
            "logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          },
          css: {
            "style.css": "body { color: red; }",
          },
        },
      })

      const files = uploader.getAllLocalFiles("/test/local")

      const filePaths = files.map((f) => f.relativePath).sort()

      expect(filePaths).not.toContain("js/app.js.map")
      expect(filePaths).not.toContain("images/logo.png")
      expect(filePaths).not.toContain(".gitignore")
      expect(filePaths).toContain("index.html")
      expect(filePaths).toContain("js/app.js")
      expect(filePaths).toContain("css/style.css")
      expect(files).toHaveLength(3)
    })

    test("debug模式应该输出排除的文件信息", () => {
      uploader.config.debug = true
      uploader.config.exclude = ["**/*.map"]

      const consoleSpy = jest.spyOn(console, "log").mockImplementation()

      mock({
        "/test/local": {
          "app.js": "content",
          "app.js.map": "map content",
        },
      })

      const files = uploader.getAllLocalFiles("/test/local")

      expect(files).toHaveLength(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("排除文件")
      )

      consoleSpy.mockRestore()
    })
  })

  describe("shouldUpload方法", () => {
    test("include规则匹配时应返回true", () => {
      const serverFiles = new Map()
      uploader.config.include = ["**/*.html"]
      const mockFile = { relativePath: "test.html" }

      const result = uploader.shouldUpload(mockFile, serverFiles)
      expect(result).toBe(true)
    })

    test("服务器不存在且不匹配include时应返回true", () => {
      const serverFiles = new Map()
      const mockFile = { relativePath: "newfile.js" }

      const result = uploader.shouldUpload(mockFile, serverFiles)
      expect(result).toBe(true)
    })

    test("服务器存在且不匹配include时应返回false", () => {
      const serverFiles = new Map()
      serverFiles.set("existing.js", {})
      const mockFile = { relativePath: "existing.js" }

      const result = uploader.shouldUpload(mockFile, serverFiles)
      expect(result).toBe(false)
    })

    test("服务器存在但匹配include时应返回true", () => {
      const serverFiles = new Map()
      serverFiles.set("existing.js", {})

      uploader.config.include = ["**/*.js"]
      const mockFile = { relativePath: "existing.js" }

      const result = uploader.shouldUpload(mockFile, serverFiles)
      expect(result).toBe(true)
    })

    test("多个include规则应该都能匹配", () => {
      // 创建独立的 serverFiles，并添加 HTML 文件
      const serverFiles = new Map()
      serverFiles.set("index.html", {}) // HTML文件在服务器上存在

      // 设置 include 规则
      uploader.config.include = ["**/*.js", "**/*.css"]

      const jsFile = { relativePath: "script.js" }
      const cssFile = { relativePath: "style.css" }
      const htmlFile = { relativePath: "index.html" }

      // 测试 shouldUpload 方法
      expect(uploader.shouldUpload(jsFile, serverFiles)).toBe(true)
      expect(uploader.shouldUpload(cssFile, serverFiles)).toBe(true)
      expect(uploader.shouldUpload(htmlFile, serverFiles)).toBe(false)
    })

    test("include规则应该支持通配符", () => {
      const serverFiles = new Map()
      serverFiles.set("js/app.js", {})

      uploader.config.include = ["**/*.min.js"]

      const minJs = { relativePath: "js/app.min.js" }
      const normalJs = { relativePath: "js/app.js" }

      // 测试 shouldUpload 方法
      expect(uploader.shouldUpload(minJs, serverFiles)).toBe(true)
      expect(uploader.shouldUpload(normalJs, serverFiles)).toBe(false)
    })

    test("空include数组应该不影响判断", () => {
      const serverFiles = new Map()
      serverFiles.set("existing.js", {})

      uploader.config.include = []

      const newFile = { relativePath: "new.js" }
      const existingFile = { relativePath: "existing.js" }

      expect(uploader.shouldUpload(newFile, serverFiles)).toBe(true)
      expect(uploader.shouldUpload(existingFile, serverFiles)).toBe(false)
    })
  })

  describe("uploadFile方法", () => {
    test("应该成功上传文件", async () => {
      const result = await uploader.uploadFile(
        "/local/test.txt",
        "/remote/test.txt"
      )

      expect(result).toBe(true)
      expect(uploader.client.ensureDir).toHaveBeenCalledWith("/remote")
      expect(uploader.client.uploadFrom).toHaveBeenCalledWith(
        "/local/test.txt",
        "/remote/test.txt"
      )
    })

    test("上传失败时应返回false", async () => {
      uploader.client.uploadFrom.mockRejectedValue(new Error("上传失败"))

      const result = await uploader.uploadFile(
        "/local/test.txt",
        "/remote/test.txt"
      )

      expect(result).toBe(false)
    })
  })

  describe("disconnect方法", () => {
    test("应该关闭FTP连接", () => {
      uploader.disconnect()
      expect(uploader.client.close).toHaveBeenCalled()
    })
  })
})

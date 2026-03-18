# FTP Uploader Tool

[![npm version](https://img.shields.io/npm/v/ftp-uploader-tool.svg)](https://www.npmjs.com/package/ftp-uploader-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个简单但强大的 FTP 上传工具，支持 include/exclude 模式匹配。特别适合用于自动化部署静态网站。

## 特性

- 🚀 简单易用的 API
- 📁 递归上传目录
- 🎯 支持 include 模式（强制上传）
- 🚫 支持 exclude 模式（排除文件）
- 🔐 支持 FTPS 加密连接
- 📊 详细的上传统计
- 🔄 自动跳过已存在的文件

## 安装

```bash
npm install --save-dev simple-ftp-uploader
```

## 基本使用

```javascript
const FtpUploader = require("simple-ftp-uploader")
const path = require("path")

const config = {
  host: "your-ftp-server.com",
  port: 21,
  username: "your-username",
  password: "your-password",
  ftps: false,
  localDir: path.resolve(__dirname, "dist"),
  remoteDir: "/public_html/",
  recursive: true,

  // 强制上传所有HTML文件
  include: ["**/*.html", "**/*.htm"],

  // 排除source maps和git文件
  exclude: ["**/*.map", ".git/**", ".gitignore"],
}

const uploader = new FtpUploader(config)
uploader.run().catch((error) => {
  console.error("❌ 程序执行失败:", error)
  process.exit(1)
})
```

## 配置选项

### 基础连接配置

| 选项       | 类型    | 必填 | 默认值 | 描述                   |
| ---------- | ------- | ---- | ------ | ---------------------- |
| `host`     | string  | 是   | -      | FTP 服务器地址         |
| `port`     | number  | 否   | 21     | FTP 端口               |
| `username` | string  | 是   | -      | 用户名                 |
| `password` | string  | 是   | -      | 密码                   |
| `ftps`     | boolean | 否   | false  | 是否使用 FTPS 加密连接 |

### 目录配置

| 选项        | 类型    | 必填 | 默认值 | 描述                                     |
| ----------- | ------- | ---- | ------ | ---------------------------------------- |
| `localDir`  | string  | 是   | -      | 本地目录路径（建议使用`path.resolve()`） |
| `remoteDir` | string  | 是   | -      | 远程目录路径                             |
| `recursive` | boolean | 否   | true   | 是否递归上传子目录                       |

### 文件过滤配置

| 选项      | 类型     | 默认值 | 描述                               |
| --------- | -------- | ------ | ---------------------------------- |
| `include` | string[] | []     | 强制上传的文件模式（支持通配符）   |
| `exclude` | string[] | []     | 排除不上传的文件模式（支持通配符） |

### 行为控制配置

| 选项        | 类型    | 默认值 | 描述                         |
| ----------- | ------- | ------ | ---------------------------- |
| `debug`     | boolean | false  | 开启调试模式，显示详细日志   |
| `quiet`     | boolean | false  | 静默模式，减少输出信息       |
| `checkSize` | boolean | false  | 是否检查文件大小（预留功能） |

## 通配符模式说明

支持以下通配符模式：

| 模式    | 描述                           | 示例                                           |
| ------- | ------------------------------ | ---------------------------------------------- |
| `*`     | 匹配任意字符（除了路径分隔符） | `*.js` 匹配所有 JS 文件                        |
| `**`    | 匹配任意层级的目录             | `**/*.html` 匹配所有子目录中的 HTML 文件       |
| `?`     | 匹配单个字符                   | `?.html` 匹配 `a.html`、`b.html`               |
| `[abc]` | 匹配字符集合中的任意一个       | `[abc].html` 匹配 `a.html`、`b.html`、`c.html` |
| `{a,b}` | 匹配多个模式                   | `*.{html,htm}` 匹配所有 `.html` 和 `.htm` 文件 |

## 配置示例

### 基础配置示例

```javascript
const path = require("path")

const config = {
  // 基础连接配置
  host: "ftp.example.com",
  port: 21,
  username: "user123",
  password: "pass456",
  ftps: false,

  // 目录配置
  localDir: path.resolve(__dirname, "dist"),
  remoteDir: "/public_html/",
  recursive: true,

  // 文件过滤规则
  include: [
    "**/*.html", // 所有HTML文件强制上传
    "**/*.htm", // 所有HTM文件强制上传
    "index.html", // 首页强制上传
    "important/**/*", // important目录下的所有文件强制上传
  ],

  exclude: [
    "**/*.map", // 排除所有source map文件
    ".gitignore", // 排除.gitignore文件
    ".git/**", // 排除整个.git目录
    "**/*.bak", // 排除备份文件
    "**/node_modules/**", // 排除node_modules目录
    "**/.DS_Store", // 排除macOS系统文件
    "**/thumbs.db", // 排除Windows系统文件
  ],

  // 可选配置
  debug: false,
  quiet: false,
}
```

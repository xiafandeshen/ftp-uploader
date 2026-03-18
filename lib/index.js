const fs = require("fs")
const path = require("path")
const ftp = require("basic-ftp")
const micromatch = require("micromatch")

class FtpUploader {
  constructor(config) {
    this.config = config
    this.client = new ftp.Client()

    // 完全禁用FTP协议的详细日志
    this.client.ftp.verbose = false
    this.client.ftp.log = () => {}
  }

  // 连接到FTP服务器
  async connect() {
    try {
      await this.client.access({
        host: this.config.host,
        port: this.config.port || 21,
        user: this.config.username,
        password: this.config.password,
        secure: this.config.ftps || false,
        secureOptions: this.config.ftps
          ? { rejectUnauthorized: false }
          : undefined,
      })
      console.log("✅ 成功连接到FTP服务器")
      return true
    } catch (error) {
      console.error("❌ 连接FTP服务器失败:", error.message)
      return false
    }
  }

  // 关闭连接
  disconnect() {
    this.client.close()
    console.log("\n👋 已断开FTP连接")
  }

  // 递归获取服务器上的所有文件
  async getServerFileList(remoteDir, currentPath = "") {
    const fileMap = new Map()

    try {
      // 获取当前目录列表
      const list = await this.client.list(remoteDir + currentPath)

      for (const item of list) {
        const itemPath = path.join(currentPath, item.name).replace(/\\/g, "/")

        if (item.type === 1) {
          // 文件
          // 使用相对路径作为key，这样就能和本地文件对应
          fileMap.set(itemPath, {
            name: item.name,
            path: itemPath,
            size: item.size,
            modified: item.modifiedAt,
          })
        } else if (item.type === 2 && this.config.recursive) {
          // 目录
          // 递归获取子目录文件
          const subFiles = await this.getServerFileList(
            remoteDir,
            itemPath + "/"
          )
          subFiles.forEach((value, key) => {
            fileMap.set(key, value)
          })
        }
      }

      return fileMap
    } catch (error) {
      if (error.code === 550) {
        // 目录不存在
        return fileMap
      }
      console.error(
        `❌ 获取服务器文件列表失败 ${remoteDir}${currentPath}:`,
        error.message
      )
      throw error
    }
  }

  // 在 lib/index.js 中检查这部分代码
  getAllLocalFiles(dir) {
    const files = []

    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir)

      for (const item of items) {
        const fullPath = path.join(currentDir, item)
        const stat = fs.statSync(fullPath)
        const relativePath = path
          .relative(this.config.localDir, fullPath)
          .replace(/\\/g, "/")

        if (stat.isFile()) {
          files.push({
            fullPath,
            relativePath,
            name: item,
            size: stat.size,
          })
        } else if (stat.isDirectory() && this.config.recursive) {
          walk(fullPath)
        }
      }
    }

    walk(dir)

    // 应用 exclude 规则过滤文件
    if (this.config.exclude && this.config.exclude.length > 0) {
      return files.filter((file) => {
        const isExcluded = micromatch.isMatch(
          file.relativePath,
          this.config.exclude,
          { dot: true }
        )
        if (isExcluded && this.config.debug) {
          console.log(`🔇 排除文件: ${file.relativePath} (匹配 exclude 规则)`)
        }
        return !isExcluded
      })
    }

    return files
  }

  shouldUpload(file, serverFiles) {
    // 检查是否匹配 include 规则（强制上传）
    if (this.config.include && this.config.include.length > 0) {
      const isIncluded = micromatch.isMatch(
        file.relativePath,
        this.config.include
      )
      if (isIncluded) {
        return true
      }
    }

    // 不匹配 include 规则的文件：服务器不存在才上传
    return !serverFiles.has(file.relativePath)
  }

  // 上传文件
  async uploadFile(localPath, remotePath) {
    try {
      const remoteDir = path.dirname(remotePath).replace(/\\/g, "/")
      await this.client.ensureDir(remoteDir)
      await this.client.uploadFrom(localPath, remotePath)
      return true
    } catch (error) {
      return false
    }
  }

  // 主同步函数
  async sync() {
    console.log("\n📁 正在扫描本地文件...")
    const localFiles = this.getAllLocalFiles(this.config.localDir)

    if (localFiles.length === 0) {
      console.log("⚠️  没有找到需要上传的文件（可能全部被 exclude 规则排除）")
      return
    }

    console.log(`   找到 ${localFiles.length} 个本地文件`)

    console.log("📡 正在递归获取服务器文件列表...")
    const serverFiles = await this.getServerFileList(this.config.remoteDir)
    console.log(`   找到 ${serverFiles.size} 个服务器文件`)

    // 分类文件
    const includeFiles = [] // 匹配 include 规则的文件（强制上传）
    const newFiles = [] // 服务器不存在的新文件
    const existingFiles = [] // 服务器已存在且不匹配 include 规则的文件

    for (const file of localFiles) {
      // 检查是否匹配 include 规则
      const isIncluded =
        this.config.include && this.config.include.length > 0
          ? micromatch.isMatch(file.relativePath, this.config.include)
          : false

      if (isIncluded) {
        includeFiles.push(file)
      } else if (serverFiles.has(file.relativePath)) {
        existingFiles.push(file)
      } else {
        newFiles.push(file)
      }
    }

    // 合并需要上传的文件：include文件 + 新文件
    const filesToUpload = [...includeFiles, ...newFiles]
    const totalToUpload = filesToUpload.length

    // 显示统计信息
    console.log(`\n📊 文件统计:`)
    if (includeFiles.length > 0) {
      console.log(
        `   📌 强制上传: ${includeFiles.length} 个 (匹配 include 规则)`
      )
    }
    console.log(`   🆕 新文件: ${newFiles.length} 个`)
    console.log(`   ⏭️  已存在文件: ${existingFiles.length} 个 (跳过)`)
    console.log(`   📤 需要上传: ${totalToUpload} 个文件\n`)

    // 显示已存在的文件（可选）
    if (existingFiles.length > 0 && !this.config.quiet) {
      console.log("⏭️  跳过的文件:")
      existingFiles.slice(0, 10).forEach((file) => {
        console.log(`   ⏭️  ${file.relativePath}`)
      })
      if (existingFiles.length > 10) {
        console.log(`   ... 还有 ${existingFiles.length - 10} 个文件未显示`)
      }
      console.log("")
    }

    // 上传文件
    if (filesToUpload.length === 0) {
      console.log("✨ 没有需要上传的文件")
      return
    }

    console.log("📤 开始上传文件:")

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      const remotePath = path
        .join(this.config.remoteDir, file.relativePath)
        .replace(/\\/g, "/")

      // 计算序号
      const currentNum = i + 1
      const totalNum = totalToUpload

      // 显示上传状态
      const fileIndicator = includeFiles.includes(file) ? "📌" : "🆕"

      process.stdout.write(
        `${currentNum}/${totalNum} 📤 正在上传: ${fileIndicator} ${file.relativePath}... `
      )

      const success = await this.uploadFile(file.fullPath, remotePath)

      if (success) {
        successCount++
        process.stdout.write(`✅ 成功\n`)
      } else {
        failCount++
        process.stdout.write(`❌ 失败\n`)
      }
    }

    // 显示最终结果
    console.log("\n✅ 上传完成统计:")
    console.log(`   ✅ 成功: ${successCount} 个文件`)
    if (failCount > 0) {
      console.log(`   ❌ 失败: ${failCount} 个文件`)
    }
    console.log(`   ⏭️  跳过: ${existingFiles.length} 个文件`)

    // 显示详细对比信息（调试用）
    if (this.config.debug) {
      console.log("\n🔍 调试信息:")
      console.log("本地文件示例:")
      localFiles
        .slice(0, 5)
        .forEach((f) => console.log(`   📄 ${f.relativePath}`))
      console.log("服务器文件示例:")
      Array.from(serverFiles.keys())
        .slice(0, 5)
        .forEach((f) => console.log(`   📄 ${f}`))
    }
  }

  // 运行
  async run() {
    console.log("🚀 开始FTP同步任务\n")

    const connected = await this.connect()
    if (!connected) {
      process.exit(1)
    }

    try {
      await this.sync()
    } catch (error) {
      console.error("\n❌ 同步过程中发生错误:", error.message)
    } finally {
      this.disconnect()
    }
  }
}

module.exports = FtpUploader

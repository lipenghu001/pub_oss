#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const Transmitter = require('../lib/transmitter');

// 文件路径
// b/manage/master/index.js

const publicPath = process.env.PUBLIC_PATH;
const htmlPublicPath = publicPath.replace('business/', 'business_html/');

const ossClient = new OSS({
  region: 'oss-accelerate',
  accessKeyId: process.env.ACCESSKEY_ID,
  accessKeySecret: process.env.ACCESSKEY_SECRET,
  bucket: 'sparrow-frontend',
});

console.log(`当前目录：${process.cwd()}`)
const distDirName = 'dist';
const distDirPath = path.join(process.cwd(), distDirName);
console.log(`distDirName: ${distDirName}`);
console.log(`distDirPath: ${distDirPath}`);

// 递归遍历dist文件夹下的所有文件
async function listFiles(dirPath, files = []) {
  // 获得文件夹下所有内容
  const fileDirents = await fs.promises.readdir(dirPath, {
    withFileTypes: true,
  });

  // 所有子文件夹
  const subDirectories = [];

  fileDirents.forEach(dirent => {
    if (dirent.isFile()) {
      // 如果是文件，push到files
      files.push({
        name: dirent.name,
        path: path.join(dirPath, dirent.name),
      });
    } else if (dirent.isDirectory()) {
      // 如果是文件夹 push到subDirectories
      subDirectories.push(dirent.name);
    }
  });

  for (let i = 0; i < subDirectories.length; i++) {
    const subDir = subDirectories[i];

    const subDirPath = path.join(dirPath, subDir);

    await listFiles(subDirPath, files);
  }

  return files;
}

// 上传文件
async function uploadFile(file) {
  // 文件在本地的绝对路径
  const filePath = file.path;
  // 文件的相对路径
  const relativePath = path.relative(distDirPath, filePath);
  // 在OSS中的路径
  const ossPath = path.join(publicPath, relativePath);

  return new Promise((resolve, reject) => {
    const startUploadFileTime = new Date();
    return ossClient
      .put(ossPath, filePath)
      .then(res => {
        resolve({
          name: relativePath,
          success: true,
          time: new Date() - startUploadFileTime,
        });
      })
      .catch(err => {
        reject({
          name: relativePath,
          success: false,
          error: err,
          time: new Date() - startUploadFileTime,
        });
      });
  });
}

// 上传文件
async function main() {
  const startTime = new Date();

  // 遍历构建出来的文件
  const files = await listFiles(distDirPath);

  const startUploadTime = new Date();
  console.log(`文件数量：${files.length}`);
  console.log(`遍历文件用时：${startUploadTime - startTime}ms`);

  const handleSuccess = res => {
    console.log(`SUCCESS: ${res.name} 用时：${res.time}`);
  };
  const handleError = res => {
    console.log(`ERROR: ${res.name} 用时：${res.time}`);
    console.error(res.error);
  };
  const handleEnd = results => {
    const count = results.length;
    const countSuccess = results.filter(item => item && item.success === true).length;
    const countFail = count - countSuccess;
    console.log(`上传文件用时：${new Date() - startUploadTime}ms。`);
    console.log(`文件总数：${count}，成功：${countSuccess}，失败：${countFail}。`);

    if (countFail > 0) {
      process.exit(1);
    }

    // 上传完成后，复制index.html到b_html下。
    ossClient
      .copy(path.join(htmlPublicPath, 'index.html'), path.join(publicPath, 'index.html'))
      .then(() => {
        console.log(`复制index.html到${path.join(htmlPublicPath, 'index.html')}下。`);
      })
      .catch(err => {
        console.error(err);
        process.exit(2);
      });
  };
  const trasmitter = new Transmitter(10, files, uploadFile, handleSuccess, handleError, handleEnd);
  trasmitter.launch();
}

main();

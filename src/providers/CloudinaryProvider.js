import { v2 as cloudinary } from 'cloudinary'
import streamifier from 'streamifier'
import { env } from '~/config/environment'
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  timeout:60000
  
})

const uploadFile = async (folderName, bufferFile) => {
  const buffer = Buffer.from(bufferFile, 'base64');
  return new Promise((resolve, reject) => {
    const updatedFile = cloudinary.uploader.upload_stream(
      { folder: folderName, timeout:60000 },
      (error, result) => {
        if (error) {
          console.log('lỗi khi upload file in cloudinary: ', error)
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
    streamifier.createReadStream(buffer).pipe(updatedFile)
  })
}

export const CloudinaryProvider = {
  uploadFile
}

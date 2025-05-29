const { log, getUploadFileAndFolderPath, storeFile, storeMultiFile } = require('../../helper')
const userModel = require('../../models/user.model')
const { FOLDER_NAME, POST_ATTACHMENT, RESPONSE_STATUS } = require('../../utils/constants')
const fs = require('fs')
const https = require('https')
const FriendController = require('../FriendController')
const friendModel = require('../../models/friend.model')
const groupHelper = require('../GroupController/groupHelper')
const helper = require('../../helper')
const friendSuggestModel = require('../../models/friend.suggest.model')
const SocketServer = require('../../socket')
const userHelper = require('./userHelper')
const { CloudinaryProvider } = require('~/providers/CloudinaryProvider')
const convertDataToUser = data => {
  const newUser = {
    _id: data.id ?? data._id,
    userName: data.name,
    searchName: helper.removeVietnameseTones(data?.name ?? ''),
    email: data.email,
    phone: null,
    avatar: data.photo,
    followerNum: 0,
    followingNum: 0,
    sex: null,
    age: null,
    fcmToken: data.fcmToken
  }
  return new userModel(newUser)
}

async function getUserDataById(uid) {
  return await userModel.findById(uid)
}

async function handleActiveUser(userID) {
  return userModel.findByIdAndUpdate(userID, { active: true })
}
async function handleInActiveUser(userID) {
  return userModel.findByIdAndUpdate(userID, { active: false })
}

async function addUser(data) {
  const convertData = convertDataToUser(data)
  const newUser = await userModel
    .create(convertData)
    .then(newUser => {
      return newUser
    })
    .catch(error => log({ error }))
  return newUser
}

class userController {
  helper = {
    getUserDataById: getUserDataById,
    handleActiveUser,
    handleInActiveUser
  }

  async getUser(req, res) {
    const idUser = req.params.id
    getUserDataById(idUser)
      .then(data => {
        res.status(200).json(data)
      })
      .catch(error => res.status(500).json({ error }))
  }
  async getAllUser(req, res) {
    userModel
      .find({})
      .then(data => {
        res.status(200).json(data)
      })
      .catch(error => res.status(500).json({ error }))
  }

  // async createUser(req, res) {
  //   console.log(req.body)
  // }

  async createUser(req, res) {
    console.log('start create user: ', req.body?._id)
    const userData = convertDataToUser(req.body)
    let newUser = await getUserDataById(userData?._id)
    if (newUser) {
      console.log('update fcmToken: ', req.body.fcmToken)
      const updateUser = await userModel.findByIdAndUpdate(
        newUser._id,
        { fcmToken: req.body.fcmToken },
        { returnDocument: 'after' }
      )

      res.json(updateUser)
    } else {
      const customData = convertDataToUser(req.body)
      const newUser = await userModel.create(customData)
      const newFriend = new friendModel({
        _id: newUser.id,
        data: []
      })
      newFriend.save()
      friendSuggestModel.create({
        _id: newUser.id,
        suggested: []
      })
      groupHelper.createGroupUser(newUser.id)
      res.status(200).json(newUser)
    }
  }

  async activeUser(req, res) {
    const userID = req.params.id
    handleActiveUser(userID)
      .then(data => {
        res.status(200).json({ _id: userID, active: true })
      })
      .catch(error => {
        console.log('Lỗi khi active user: ', error)
        res.status(500).json({ error })
      })
  }

  async inActiveUser(req, res) {
    const userID = req.params.id
    handleInActiveUser(userID)
      .then(data => {
        res.status(200).json({ _id: userID, active: false })
      })
      .catch(error => {
        console.log('Lỗi khi in active user: ', error)
        res.status(500).json({ error })
      })
  }

  async conventionUserInfor(req, res) {
    const userID = req.params.id
    userModel
      .findById(userID)
      .then(data => {
        if (data) {
          const { _id, userName, avatar, active, updatedAt } = data
          const customData = { _id, userName, avatar, active, updatedAt }
          res.json(customData)
        } else {
          res.status(200).json(null)
        }
      })
      .catch(error => {
        console.log('Lỗi khi in get convention user infor: ', error)
        res.status(500).json({ error })
      })
  }

  async handleUpdateBio(req, res) {
    const userID = req.params.id
    userModel
      .findByIdAndUpdate(userID, { bio: req.body.value }, { returnDocument: 'after' })
      .then(data => {
        res.status(200).json(RESPONSE_STATUS.SUCCESS)
        SocketServer.instance.emitBioProfileChange(userID, data.bio)
      })
      .catch(error => {
        console.log('error when update bio: ', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleUpdateUserName(req, res) {
    const userID = req.params.id
    userModel
      .findByIdAndUpdate(userID, { userName: req.body.value }, { returnDocument: 'after' })
      .then(async data => {
        await userHelper.updateUserNameRelationship(userID, req.body.value)
        res.status(200).json(RESPONSE_STATUS.SUCCESS)
        // SocketServer.instance.emitBioProfileChange(userID, data.bio)
      })
      .catch(error => {
        console.log('error when update userName: ', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleUpdateAvatar(req, res) {
    const userID = req.params.id
    const { current, avatar } = req.body

    const updatedAvatar = await CloudinaryProvider.uploadFile(FOLDER_NAME.USERS, avatar)
    const avatarPath = updatedAvatar.secure_url

    await userHelper.updateUserAvatarRelationship(userID, avatarPath)
    userModel
      .findByIdAndUpdate(userID, { avatar: avatarPath }, { returnDocument: 'after' })
      .then(data => {
        console.log('update avatar successfully: ', avatarPath)
        res.status(200).json(RESPONSE_STATUS.SUCCESS)
        SocketServer.instance.emitAvatarProfileChange(userID, data.avatar)
      })
      .catch(error => {
        console.log('error when update avatar: ', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleUpdateBackground(req, res) {
    const userID = req.params.id
    const { current, background } = req.body
    const updatedBackground = await CloudinaryProvider.uploadFile(FOLDER_NAME.USERS, background)
    const backgroundPath = updatedBackground.secure_url
    userModel
      .findByIdAndUpdate(userID, { background: backgroundPath }, { returnDocument: 'after' })
      .then(data => {
        console.log('update background successfully: ', backgroundPath)
        res.status(200).json(data)
        SocketServer.instance.emitBackgroundProfileChange(userID, data.background)
      })
      .catch(error => {
        console.log('error when update background: ', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }
}

module.exports = new userController()

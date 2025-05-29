const commentModel = require('~/models/comment.model')
const { log } = require('../../helper')
const conventionModel = require('../../models/convention.model')
const friendModel = require('../../models/friend.model')
const groupMemberModel = require('../../models/group.member.model')
const postModel = require('../../models/post.model')
const userModel = require('../../models/user.model')
const reactionModel = require('~/models/reaction.model')
const convertDataToUser = data => {
  const newUser = {
    _id: data.id,
    userName: data.name,
    email: data.email,
    phone: null,
    avatar: data.photo,
    followerNum: 0,
    followingNum: 0,
    sex: null,
    age: null
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
  try {
    const newUser = await userModel.create(convertData).then(newUser => {
      return newUser
    })
    return newUser
  } catch (error) {
    console.log('error when add user: ', error)
  }
}

async function updateUserAvatarRelationship(userID, newAvatarPath) {
  //convention
  await conventionModel.updateMany(
    { uids: userID, 'members._id': userID },
    { $set: { 'members.$.avatar': newAvatarPath } }
  )
  //post
  await postModel.updateMany({ userID }, { avatar: newAvatarPath })
  // comment
  await commentModel.updateMany({userID}, {avatar: newAvatarPath})
  // reaction
  await reactionModel.updateMany({userID}, {avatar: newAvatarPath})
  // friend
  await friendModel.updateMany({ 'data._id': userID }, { $set: { 'data.$.avatar': newAvatarPath } })
  //groupMember
  await groupMemberModel.updateMany({ userID }, { avatar: newAvatarPath })
}

async function updateUserNameRelationship(userID, newName) {
  //convention
  await conventionModel.updateMany(
    { uids: userID, 'members._id': userID },
    { $set: { 'members.$.userName': newName } }
  )
  //post
  await postModel.updateMany({ userID }, { userName: newName })
  // comment
  await commentModel.updateMany({userID}, {userName: newName})
   // reaction
   await reactionModel.updateMany({userID}, {userName: newName})
  // friend
  await friendModel.updateMany({ 'data._id': userID }, { $set: { 'data.$.userName': newName } })
  //groupMember
  await groupMemberModel.updateMany({ userID }, { userName: newName })
}

const userHelper = {
  getUserDataById,
  handleActiveUser,
  handleInActiveUser,
  updateUserAvatarRelationship,
  updateUserNameRelationship
}

module.exports = userHelper

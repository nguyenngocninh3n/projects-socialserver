const SocketServer = require('~/socket')
const helper = require('../../helper')
const postModel = require('../../models/post.model')
const {
  RESPONSE_STATUS,
  FOLDER_NAME,
  POST_ATTACHMENT,
  FILE_EXT,
  POST_ACTION,
  POST_STATUS,
  SCOPE,
  MESSAGE_TYPE
} = require('../../utils/constants')
const friendHelper = require('../FriendController/friendHelper')
const UserController = require('../UserController')
const userHelper = require('../UserController/userHelper')
const { tagImage, tagVideo } = require('../vision')
const { getNewFeedPosts } = require('./postMethod')
const { CloudinaryProvider } = require('~/providers/CloudinaryProvider')


const getUserPosts = async (userID, ownerID, status, groupID = null) => {
  const queyObj = {
    userID: userID,
    status: status
  }
  if (ownerID === userID) {
    const posts = await postModel.find({ ...queyObj, groupID: null }).sort({ createdAt: 'desc' })
    return posts
  } else {
    const friendStatus = await friendHelper.getFriendStatus(ownerID, userID)
    console.log('friend status: ', friendStatus)
    const scope = friendStatus === SCOPE.FRIEND ? [SCOPE.PUBLIC, SCOPE.FRIEND] : SCOPE.PUBLIC
    console.log('scope: ', scope)
    const posts = await postModel.find({ ...queyObj, scope: { $in: scope }, groupID }).sort({ createdAt: 'desc' })
    return posts
  }
}

const getUserTrashPosts = async (userID, status) => {
  const listTrashPost = await postModel.find({ userID, status: POST_STATUS.TRASH })
  return listTrashPost
}

class PostController {
  async handleGetPost(req, res) {
    const postID = req.params.id
    postModel
      .findById(postID)
      .then(data => {
        console.log('postData: ', data)
        res.status(200).json(data)
      })
      .catch(error => {
        console.log('error when get user posts: ')
        res.status(500).json({
          error
        })
      })
  }

  async handleGetNewFeedPostsByUserID(req, res) {
    const { userID } = req.params
    console.log('into handleGetNewFeedPostsByUserID: ', userID)
    const data = await getNewFeedPosts(userID)
    res.status(200).json(data)
  }

  async handleGetUserPosts(req, res) {
    const { userID, ownerID } = req.query
    console.log('query: ', req.query)
    await getUserPosts(userID, ownerID, POST_STATUS.ACTIVE, null)
      .then(response => {
        const customData = {
          status: RESPONSE_STATUS.SUCCESS,
          data: response
        }
        res.status(200).json(customData)
      })
      .catch(error => {
        console.log('error when handle get user posts: ', error)
        res.status(500).json({ error })
      })
  }

  async handleGetUserTrashPosts(req, res) {
    const { userId } = req.params
    await getUserTrashPosts(userId)
      .then(response => {
        const customData = {
          status: RESPONSE_STATUS.SUCCESS,
          data: response
        }
        res.status(200).json(customData)
      })
      .catch(error => {
        console.log('error when handle get user posts: ', error)
        res.status(500).json({ error })
      })
  }

  async handleStorePost(req, res) {
    const data = req.body
    console.log('attachment in store post: ', data.scope)
  
    const newAttachments = []
    for (const item of data.attachments) {
      const updatedFile = await CloudinaryProvider.uploadFile(FOLDER_NAME.POSTS, item.source)
      newAttachments.push({type: updatedFile.resource_type.toUpperCase(), source: updatedFile.secure_url})
    }

    const newPost = new postModel({
      ...data,
      attachments: newAttachments
    })
    newPost
      .save()
      .then(async result => {
        SocketServer.instance.emitAddPost(data.userID, result)
        // for (let index in newAttachments) {
        //   const item = newAttachments[index]
          // const filePath = helper.getStaticFilePathFromRelateFilePath(item.source)
          // if(item.type === MESSAGE_TYPE.VIDEO) {
          //   // const labels = await tagVideo(filePath)
          //   // console.log('labels video: ', labels)
          // } else if (item.type === MESSAGE_TYPE.IMAGE) {
          //   const results = await tagImage(filePath)
          //  await postModel.findByIdAndUpdate(result._id, {labels: results.at(0), transLabels: results.at(1), detectText: results.at(2)})
          // }
        // }
        res.status(200).json(RESPONSE_STATUS.SUCCESS)
      })
      .catch(error => {
        console.log('Error when store post: ', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleEditPost(req, res) {
    console.log('update post: ', req.body)
    const postID = req.params.id
    const data = req.body
    switch (data.action) {
      case POST_ACTION.UPDATE_CONTENT: {
        postModel
          .findByIdAndUpdate(postID, { content: data.content, scope: data.scope }, { returnDocument: 'after' })
          .then(result => {
            res.status(200).json(RESPONSE_STATUS.SUCCESS)
            SocketServer.instance.emitEditPost(postID, result)
          })
          .catch(error => {
            console.log('Error when update content post: ', error)
            res.status(500).json(RESPONSE_STATUS.ERROR)
          })
        break
      }
      case POST_ACTION.UPDATE_ATTACHMENT: {
        const newAttachments = []
        for (const item of data.attachments) {
          const updatedFile = await CloudinaryProvider.uploadFile(FOLDER_NAME.POSTS, item.source)
          newAttachments.push({type: updatedFile.resource_type.toUpperCase(), source: updatedFile.secure_url})
        }
        // const newAttachments = handleSavedAndGetAttachments(data.userID, data.attachments)
        postModel
          .findByIdAndUpdate(postID, { attachments: newAttachments, scope: data.scope })
          .then(async result => {
            res.status(200).json(RESPONSE_STATUS.SUCCESS)
            // for (let index in newAttachments) {
            //   const item = newAttachments[index]
            //   const filePath = helper.getStaticFilePathFromRelateFilePath(item.source)
            //   if (item.type === MESSAGE_TYPE.VIDEO) {
            //     // const labels = await tagVideo(filePath)
            //     console.log('labels video: ', labels)
            //   } else if (item.type === MESSAGE_TYPE.IMAGE) {
            //     const results = await tagImage(filePath)
            //     await postModel.findByIdAndUpdate(result._id, {
            //       labels: results.at(0),
            //       transLabels: results.at(1),
            //       detectText: results.at(2)
            //     })
            //   }
            // }
          })
          .catch(error => {
            console.log('Error when update attachments post: ', error)
            res.status(500).json(RESPONSE_STATUS.ERROR)
          })
        break
      }
      case POST_ACTION.UPDATE_ALL: {
        const newAttachments = []
        for (const item of data.attachments) {
          const updatedFile = await CloudinaryProvider.uploadFile(FOLDER_NAME.POSTS, item.source)
          newAttachments.push({type: updatedFile.resource_type.toUpperCase(), source: updatedFile.secure_url})
        }
        postModel
          .findByIdAndUpdate(postID, { content: data.content, scope: data.scope, attachments: newAttachments })
          .then(result => {
            res.status(200).json(RESPONSE_STATUS.SUCCESS)
          })
          .catch(error => {
            console.log('Error when update content & attachments post: ', error)
            res.status(500).json(RESPONSE_STATUS.ERROR)
          })
        break
      }
      default: {
        console.log('Error when update content & attachments post: Invalid action')
        res.status(500).json(RESPONSE_STATUS.ERROR)
      }
    }
  }

  async handleTrashPost(req, res) {
    const postID = req.params.id
    console.log('post id: ', ' ', typeof postID, ' ', postID)
    postModel
      .findByIdAndUpdate(postID, { status: POST_STATUS.TRASH })
      .then(data => {
        res.status(200).json(RESPONSE_STATUS.SUCCESS)
        SocketServer.instance.emitRemovePost(postID)
      })
      .catch(error => {
        console.log('Error when trash post', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleDeletePosts(req, res) {
    const { deleteIds } = req.body
    postModel
      .updateMany({ _id: deleteIds }, { status: POST_STATUS.DELETE })
      .then(data => {
        res.status(200).json({ status: RESPONSE_STATUS.SUCCESS })
      })
      .catch(error => {
        console.log('Error when delete post', error)
        res.status(500).json(RESPONSE_STATUS.ERROR)
      })
  }

  async handleSharePost(req, res) {}
}

module.exports = new PostController()

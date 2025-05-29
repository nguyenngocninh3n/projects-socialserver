const express = require('express')
const PostController = require('../controllers/PostController')
const postRouter = express.Router()

postRouter.get('/newfeed/:userID', PostController.handleGetNewFeedPostsByUserID)
postRouter.get('/user', PostController.handleGetUserPosts)
postRouter.get('/trash/:userId', PostController.handleGetUserTrashPosts)
postRouter.get('/:id/', PostController.handleGetPost)

postRouter.put('/delete', PostController.handleDeletePosts)
postRouter.put('/:id/edit', PostController.handleEditPost)
postRouter.put('/:id/trash', PostController.handleTrashPost)
postRouter.post('/:id/share', PostController.handleEditPost)
postRouter.post('/store', PostController.handleStorePost)

module.exports = postRouter

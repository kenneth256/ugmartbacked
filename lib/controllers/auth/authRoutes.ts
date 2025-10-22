import express, { Router }  from "express"
import { getUsers, login, logout, refreshAccessToken, register }  from "./routes.js"

const router: Router = express()

router.post('/register', register)
router.get('/users', getUsers)
router.post('/login', login)
router.post('/logout', logout)
router.post('/refreshToken', refreshAccessToken)


export default router
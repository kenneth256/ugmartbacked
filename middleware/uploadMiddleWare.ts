import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Ensure upload directory exists
const uploadDir = 'upload'
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'upload/')
    },
    filename: function(req, file, cb) {  
        
        cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
    }
})

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if(file.mimetype.startsWith('image')) {
        cb(null, true)
    } else {
        cb(new Error('Not an image, please upload only images!'))
    }
}

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 }  
})
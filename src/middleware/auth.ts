import jwt from 'jsonwebtoken'
import 'dotenv/config'
import { Request, Response } from 'express';

const auth = (req: Request, res: Response, next: any) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (token) {
            const decodedData: any = jwt.verify(token, `${process.env.KEY}`)
            req.body.userId = decodedData.id;
            next();
        }
    } catch (err) {
        console.log(err);
    }
}

export default auth;
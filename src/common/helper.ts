import * as bcrypt from 'bcrypt'
import *as fs from 'fs'

export const encodePassword = async (password: string) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
}

export const checkPassword = (password: string, hash: string) => {
    const check = bcrypt.compareSync(password, hash);
    return check
}


export const checkIfFileExists = (path = '') => {
    try {
        if (fs.existsSync(path)) {
            return true;
        }
        return false
    } catch (error) {
        return false
    }
}
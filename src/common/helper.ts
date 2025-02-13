import * as bcrypt from 'bcrypt'

export const encodePassword = async (password: string) =>{
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
}

export const checkPassword = (password : string, hash: string)=>{
    const check = bcrypt.compareSync(password,hash);
    return check
}
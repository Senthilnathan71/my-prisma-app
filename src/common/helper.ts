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



export const getClientIp = (req: any): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Sometimes contains a list: "client, proxy1, proxy2"
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    return ips[0]; // return the first (client IP)
  }

  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    'unknown'
  );
};


import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
@Injectable()
export class HashService {
  hash(v: string) { return argon2.hash(v, { type: argon2.argon2id }); }
  verify(hash: string, plain: string) { return argon2.verify(hash, plain); }
}

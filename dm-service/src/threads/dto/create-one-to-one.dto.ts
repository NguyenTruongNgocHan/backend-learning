import { IsString, IsNotEmpty } from 'class-validator';

export class CreateOneToOneDto {
  @IsString()
  @IsNotEmpty()
  peerId!: string;
}

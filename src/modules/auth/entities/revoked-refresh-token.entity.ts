import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores revoked refresh token JTIs so that after logout,
 * the refresh token cannot be used to obtain new access tokens.
 * expiresAt matches the token's exp for pruning old rows.
 */
@Entity('revoked_refresh_tokens')
@Index(['jti'], { unique: true })
@Index(['expiresAt'])
export class RevokedRefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  jti: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

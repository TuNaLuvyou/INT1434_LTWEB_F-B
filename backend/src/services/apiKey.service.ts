import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { AppError } from '../utils/app-error';

const KEY_PREFIX = 'hiai';
const PREFIX_LENGTH = 8;
const KEY_LENGTH = 32;

function generateRawKey(): { raw: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  const randomPart = randomBytes.toString('base64url').substring(0, KEY_LENGTH);
  const prefixRaw = crypto.randomBytes(6).toString('base64url').substring(0, PREFIX_LENGTH - KEY_PREFIX.length - 1);
  const prefix = `${KEY_PREFIX}_${prefixRaw}`;
  const raw = `${prefix}_${randomPart}`;
  const hash = bcrypt.hashSync(raw, 10);
  return { raw, prefix, hash };
}

export async function generateApiKey(
  tenantId: string,
  name: string,
  expiresAt?: Date | null
): Promise<{ id: string; rawKey: string; name: string; keyPrefix: string; expiresAt: Date | null }> {
  const { raw, prefix, hash } = generateRawKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      expiresAt: expiresAt || null,
    },
    select: { id: true, name: true, keyPrefix: true, expiresAt: true },
  });

  return { ...apiKey, rawKey: raw };
}

export async function verifyApiKey(rawKey: string): Promise<{ tenantId: string; keyId: string }> {
  const parts = rawKey.split('_');
  if (parts.length < 3 || parts[0] !== KEY_PREFIX) {
    throw new AppError(401, 'INVALID_API_KEY', 'Invalid API key format');
  }

  const prefix = `${parts[0]}_${parts[1]}`;

  const apiKey = await prisma.apiKey.findFirst({ where: { keyPrefix: prefix } });
  if (!apiKey) {
    throw new AppError(401, 'INVALID_API_KEY', 'API key not found');
  }

  if (!apiKey.isActive) {
    throw new AppError(401, 'API_KEY_INACTIVE', 'API key has been revoked');
  }

  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    throw new AppError(401, 'API_KEY_EXPIRED', 'API key has expired');
  }

  const isValid = bcrypt.compareSync(rawKey, apiKey.keyHash);
  if (!isValid) {
    throw new AppError(401, 'INVALID_API_KEY', 'API key is invalid');
  }

  updateLastUsed(apiKey.id).catch(() => {});

  return { tenantId: apiKey.tenantId, keyId: apiKey.id };
}

export async function listApiKeys(tenantId: string) {
  const keys = await prisma.apiKey.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return keys;
}

export async function revokeApiKey(id: string, tenantId: string) {
  const existing = await prisma.apiKey.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'API key not found');
  }

  await prisma.apiKey.delete({
    where: { id },
  });
}

export async function updateApiKey(
  id: string,
  tenantId: string,
  data: { name?: string; expiresAt?: Date | null; isActive?: boolean }
) {
  const existing = await prisma.apiKey.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'API key not found');
  }

  const updated = await prisma.apiKey.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

async function updateLastUsed(id: string) {
  await prisma.apiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

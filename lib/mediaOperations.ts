export interface SupabaseErrorLike {
  message: string;
}

export interface SupabaseResult<T = unknown> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

export class MediaOperationError extends Error {
  constructor(
    public readonly action: string,
    public readonly causeMessage: string,
  ) {
    super(`${action}: ${causeMessage}`);
    this.name = "MediaOperationError";
  }
}

export function requireSupabaseSuccess<T>(
  result: SupabaseResult<T>,
  action: string,
): T | null {
  if (result.error) {
    throw new MediaOperationError(action, result.error.message);
  }
  return result.data;
}

export async function runOptimisticMutation(
  mutate: () => PromiseLike<SupabaseResult<unknown>>,
  restore: () => void,
  action: string,
): Promise<void> {
  try {
    const result = await mutate();
    requireSupabaseSuccess(result, action);
  } catch (error) {
    restore();
    throw error;
  }
}

export interface DeleteMediaDependencies {
  findShared: (
    url: string,
    id: number,
  ) => PromiseLike<SupabaseResult<Array<{ id: number }>>>;
  deleteRecord: (id: number) => PromiseLike<SupabaseResult<unknown>>;
  removeObject: (objectName: string) => PromiseLike<SupabaseResult<unknown>>;
}

export interface DeleteMediaResult {
  databaseDeleted: true;
  cleanupWarning: { objectName: string; message: string } | null;
}

function objectNameFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.length > 0 ? decodeURIComponent(segments.at(-1)!) : null;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function deleteMedia(
  dependencies: DeleteMediaDependencies,
  input: { id: number; url: string },
): Promise<DeleteMediaResult> {
  const shared =
    requireSupabaseSuccess(
      await dependencies.findShared(input.url, input.id),
      "ตรวจสอบการใช้ไฟล์ร่วมกัน",
    ) ?? [];

  requireSupabaseSuccess(
    await dependencies.deleteRecord(input.id),
    "ลบรายการสื่อ",
  );

  if (shared.length > 0) {
    return { databaseDeleted: true, cleanupWarning: null };
  }

  const objectName = objectNameFromUrl(input.url);
  if (!objectName) {
    return { databaseDeleted: true, cleanupWarning: null };
  }

  let cleanup: SupabaseResult<unknown>;
  try {
    cleanup = await dependencies.removeObject(objectName);
  } catch (error) {
    return {
      databaseDeleted: true,
      cleanupWarning: {
        objectName,
        message: errorMessage(error, "ไม่สามารถเชื่อมต่อคลังไฟล์ได้"),
      },
    };
  }
  if (cleanup.error) {
    return {
      databaseDeleted: true,
      cleanupWarning: { objectName, message: cleanup.error.message },
    };
  }

  return { databaseDeleted: true, cleanupWarning: null };
}

export interface MediaInsertInput {
  url: string;
  type: "image" | "video";
  duration: number;
  row_slot: 1 | 2 | 3;
  kiosk_id: string;
}

export type InsertFallback = "none" | "without-kiosk" | "basic";

type InsertRecord = (
  value: Partial<MediaInsertInput>,
) => PromiseLike<SupabaseResult<unknown>>;

export async function insertMediaWithCompatibility(
  insert: InsertRecord,
  input: MediaInsertInput,
): Promise<{ fallback: InsertFallback }> {
  let result = await insert(input);
  if (!result.error) return { fallback: "none" };

  if (result.error.message.includes("kiosk_id")) {
    result = await insert({
      url: input.url,
      type: input.type,
      duration: input.duration,
      row_slot: input.row_slot,
    });
    if (!result.error) return { fallback: "without-kiosk" };
  }

  if (result.error?.message.includes("row_slot")) {
    result = await insert({
      url: input.url,
      type: input.type,
      duration: input.duration,
    });
    if (!result.error) return { fallback: "basic" };
  }

  requireSupabaseSuccess(result, "เพิ่มรายการสื่อ");
  return { fallback: "none" };
}

export interface UploadMediaDependencies {
  uploadObject: (
    objectName: string,
    file: File,
  ) => PromiseLike<SupabaseResult<unknown>>;
  getPublicUrl: (objectName: string) => string;
  insertRecord: InsertRecord;
  removeObject: (objectName: string) => PromiseLike<SupabaseResult<unknown>>;
}

export class UploadMediaError extends Error {
  constructor(
    public readonly primaryMessage: string,
    public readonly orphanedObjectName: string | null,
    public readonly cleanupMessage: string | null,
  ) {
    super(
      orphanedObjectName
        ? `${primaryMessage}; ลบไฟล์ ${orphanedObjectName} ที่อัปโหลดไว้ไม่สำเร็จ: ${cleanupMessage}`
        : primaryMessage,
    );
    this.name = "UploadMediaError";
  }
}

export async function uploadMedia(
  dependencies: UploadMediaDependencies,
  input: {
    file: File;
    objectName: string;
    duration: number;
    rowSlot: 1 | 2 | 3;
    kioskId: string;
  },
): Promise<{ publicUrl: string; fallback: InsertFallback }> {
  requireSupabaseSuccess(
    await dependencies.uploadObject(input.objectName, input.file),
    "อัปโหลดไฟล์",
  );

  const publicUrl = dependencies.getPublicUrl(input.objectName);
  const type = input.file.type.startsWith("video") ? "video" : "image";

  try {
    const inserted = await insertMediaWithCompatibility(
      dependencies.insertRecord,
      {
        url: publicUrl,
        type,
        duration: input.duration,
        row_slot: input.rowSlot,
        kiosk_id: input.kioskId,
      },
    );
    return { publicUrl, fallback: inserted.fallback };
  } catch (error) {
    const primaryMessage = errorMessage(error, "เพิ่มรายการสื่อไม่สำเร็จ");
    let cleanup: SupabaseResult<unknown>;
    try {
      cleanup = await dependencies.removeObject(input.objectName);
    } catch (cleanupError) {
      throw new UploadMediaError(
        primaryMessage,
        input.objectName,
        errorMessage(cleanupError, "ไม่สามารถเชื่อมต่อคลังไฟล์ได้"),
      );
    }
    if (cleanup.error) {
      throw new UploadMediaError(
        primaryMessage,
        input.objectName,
        cleanup.error.message,
      );
    }
    throw new UploadMediaError(primaryMessage, null, null);
  }
}

import { describe, expect, it, vi } from "vitest";
import {
  deleteMedia,
  insertMediaWithCompatibility,
  MediaOperationError,
  requireSupabaseSuccess,
  runOptimisticMutation,
  uploadMedia,
} from "./mediaOperations";

describe("requireSupabaseSuccess", () => {
  it("returns data when Supabase reports success", () => {
    expect(
      requireSupabaseSuccess({ data: { id: 7 }, error: null }, "บันทึกข้อมูล"),
    ).toEqual({ id: 7 });
  });

  it("throws when Supabase resolves with an error", () => {
    expect(() =>
      requireSupabaseSuccess(
        { data: null, error: { message: "permission denied" } },
        "บันทึกข้อมูล",
      ),
    ).toThrow(new MediaOperationError("บันทึกข้อมูล", "permission denied"));
  });
});

describe("runOptimisticMutation", () => {
  it("restores the previous UI state when persistence fails", async () => {
    const restore = vi.fn();

    await expect(
      runOptimisticMutation(
        async () => ({ data: null, error: { message: "network error" } }),
        restore,
        "อัปเดตสื่อ",
      ),
    ).rejects.toThrow("อัปเดตสื่อ: network error");

    expect(restore).toHaveBeenCalledOnce();
  });

  it("does not restore state after confirmed success", async () => {
    const restore = vi.fn();

    await runOptimisticMutation(
      async () => ({ data: null, error: null }),
      restore,
      "อัปเดตสื่อ",
    );

    expect(restore).not.toHaveBeenCalled();
  });

  it("restores state when the mutation promise rejects", async () => {
    const restore = vi.fn();

    await expect(
      runOptimisticMutation(
        async () => {
          throw new Error("connection lost");
        },
        restore,
        "อัปเดตสื่อ",
      ),
    ).rejects.toThrow("connection lost");

    expect(restore).toHaveBeenCalledOnce();
  });
});

function deleteDependencies(overrides: Record<string, unknown> = {}) {
  return {
    findShared: vi.fn(async () => ({ data: [], error: null })),
    deleteRecord: vi.fn(async () => ({ data: null, error: null })),
    removeObject: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe("deleteMedia", () => {
  it("stops before deleting when the shared-file query fails", async () => {
    const deps = deleteDependencies({
      findShared: vi.fn(async () => ({
        data: null,
        error: { message: "query failed" },
      })),
    });

    await expect(
      deleteMedia(deps, { id: 3, url: "https://host/files/photo.jpg" }),
    ).rejects.toThrow("ตรวจสอบการใช้ไฟล์ร่วมกัน: query failed");
    expect(deps.deleteRecord).not.toHaveBeenCalled();
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("leaves storage untouched when database deletion fails", async () => {
    const deps = deleteDependencies({
      deleteRecord: vi.fn(async () => ({
        data: null,
        error: { message: "delete denied" },
      })),
    });

    await expect(
      deleteMedia(deps, { id: 3, url: "https://host/files/photo.jpg" }),
    ).rejects.toThrow("ลบรายการสื่อ: delete denied");
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("keeps a shared storage object", async () => {
    const deps = deleteDependencies({
      findShared: vi.fn(async () => ({ data: [{ id: 9 }], error: null })),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({ databaseDeleted: true, cleanupWarning: null });
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("returns an orphan warning when storage cleanup fails", async () => {
    const deps = deleteDependencies({
      removeObject: vi.fn(async () => ({
        data: null,
        error: { message: "storage denied" },
      })),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({
      databaseDeleted: true,
      cleanupWarning: {
        objectName: "photo.jpg",
        message: "storage denied",
      },
    });
  });

  it("returns an orphan warning when storage cleanup rejects", async () => {
    const deps = deleteDependencies({
      removeObject: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result.cleanupWarning).toEqual({
      objectName: "photo.jpg",
      message: "connection lost",
    });
  });

  it("deletes an unshared object only after database success", async () => {
    const calls: string[] = [];
    const deps = deleteDependencies({
      deleteRecord: vi.fn(async () => {
        calls.push("database");
        return { data: null, error: null };
      }),
      removeObject: vi.fn(async () => {
        calls.push("storage");
        return { data: null, error: null };
      }),
    });

    const result = await deleteMedia(deps, {
      id: 3,
      url: "https://host/files/photo.jpg",
    });

    expect(result).toEqual({ databaseDeleted: true, cleanupWarning: null });
    expect(calls).toEqual(["database", "storage"]);
    expect(deps.removeObject).toHaveBeenCalledWith("photo.jpg");
  });
});

const mediaInput = {
  url: "https://host/files/photo.jpg",
  type: "image" as const,
  duration: 10,
  row_slot: 2 as const,
  kiosk_id: "kiosk-1",
};

describe("insertMediaWithCompatibility", () => {
  it("uses the no-kiosk fallback only for a missing kiosk_id column", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "column kiosk_id does not exist" },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await insertMediaWithCompatibility(insert, mediaInput);

    expect(result.fallback).toBe("without-kiosk");
    expect(insert).toHaveBeenNthCalledWith(2, {
      url: mediaInput.url,
      type: mediaInput.type,
      duration: mediaInput.duration,
      row_slot: mediaInput.row_slot,
    });
  });

  it("uses the basic fallback for a missing row_slot column", async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "column row_slot does not exist" },
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await insertMediaWithCompatibility(insert, mediaInput);

    expect(result.fallback).toBe("basic");
    expect(insert).toHaveBeenNthCalledWith(2, {
      url: mediaInput.url,
      type: mediaInput.type,
      duration: mediaInput.duration,
    });
  });
});

function uploadDependencies(overrides: Record<string, unknown> = {}) {
  return {
    uploadObject: vi.fn(async () => ({ data: null, error: null })),
    getPublicUrl: vi.fn(() => "https://host/files/photo.jpg"),
    insertRecord: vi.fn(async () => ({ data: null, error: null })),
    removeObject: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  };
}

describe("uploadMedia", () => {
  const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });

  it("stops when storage upload fails", async () => {
    const deps = uploadDependencies({
      uploadObject: vi.fn(async () => ({
        data: null,
        error: { message: "upload denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toThrow("อัปโหลดไฟล์: upload denied");
    expect(deps.insertRecord).not.toHaveBeenCalled();
    expect(deps.removeObject).not.toHaveBeenCalled();
  });

  it("removes the uploaded object when every insert attempt fails", async () => {
    const deps = uploadDependencies({
      insertRecord: vi.fn(async () => ({
        data: null,
        error: { message: "insert denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toMatchObject({
      primaryMessage: "เพิ่มรายการสื่อ: insert denied",
      orphanedObjectName: null,
      cleanupMessage: null,
    });
    expect(deps.removeObject).toHaveBeenCalledWith("123.jpg");
  });

  it("reports the object name when rollback also fails", async () => {
    const deps = uploadDependencies({
      insertRecord: vi.fn(async () => ({
        data: null,
        error: { message: "insert denied" },
      })),
      removeObject: vi.fn(async () => ({
        data: null,
        error: { message: "cleanup denied" },
      })),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toMatchObject({
      primaryMessage: "เพิ่มรายการสื่อ: insert denied",
      orphanedObjectName: "123.jpg",
      cleanupMessage: "cleanup denied",
    });
  });

  it("reports the object name when rollback rejects", async () => {
    const deps = uploadDependencies({
      insertRecord: vi.fn(async () => ({
        data: null,
        error: { message: "insert denied" },
      })),
      removeObject: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    });

    await expect(
      uploadMedia(deps, {
        file,
        objectName: "123.jpg",
        duration: 10,
        rowSlot: 2,
        kioskId: "kiosk-1",
      }),
    ).rejects.toMatchObject({
      primaryMessage: "เพิ่มรายการสื่อ: insert denied",
      orphanedObjectName: "123.jpg",
      cleanupMessage: "connection lost",
    });
  });

  it("keeps the object after a successful insert", async () => {
    const deps = uploadDependencies();

    const result = await uploadMedia(deps, {
      file,
      objectName: "123.jpg",
      duration: 10,
      rowSlot: 2,
      kioskId: "kiosk-1",
    });

    expect(result).toEqual({
      publicUrl: "https://host/files/photo.jpg",
      fallback: "none",
    });
    expect(deps.removeObject).not.toHaveBeenCalled();
  });
});

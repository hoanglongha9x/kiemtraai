"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import {
  Button,
} from "@/components/ui";

import type {
  QuestionImageUploadHandler,
  QuestionImageUploadResult,
} from "./types";

import styles from "./QuestionImageUploadModal.module.css";

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

export type QuestionImageUploadModalProps = {
  open: boolean;

  currentImageId?: string;
  currentImageUrl?: string;

  title?: string;
  description?: string;

  disabled?: boolean;

  onUpload:
    QuestionImageUploadHandler;

  onConfirm: (
    result:
      QuestionImageUploadResult
  ) => void;

  onClose: () => void;
};

function validateImageFile(
  file: File
): string {
  if (
    !ALLOWED_IMAGE_TYPES.has(
      file.type
    )
  ) {
    return "Chỉ hỗ trợ hình ảnh JPG, PNG hoặc WEBP.";
  }

  if (
    file.size <= 0
  ) {
    return "File hình ảnh không hợp lệ.";
  }

  if (
    file.size >
    MAX_IMAGE_SIZE
  ) {
    return "Dung lượng hình ảnh không được vượt quá 5 MB.";
  }

  return "";
}

function getPreviewUrl(
  imageId?: string,
  imageUrl?: string
): string {
  const normalizedImageId =
    String(
      imageId ?? ""
    ).trim();

  if (
    normalizedImageId
  ) {
    return `/api/question-images/${encodeURIComponent(
      normalizedImageId
    )}`;
  }

  return String(
    imageUrl ?? ""
  ).trim();
}

export default function QuestionImageUploadModal({
  open,

  currentImageId = "",
  currentImageUrl = "",

  title =
    "Thêm hình ảnh",

  description =
    "Chọn hình ảnh minh họa cho câu hỏi.",

  disabled = false,

  onUpload,
  onConfirm,
  onClose,
}: QuestionImageUploadModalProps) {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState("");

  const [
    uploadedResult,
    setUploadedResult,
  ] =
    useState<QuestionImageUploadResult | null>(
      null
    );

  const [
    dragging,
    setDragging,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  useEffect(
    () => {
      if (
        !open
      ) {
        return;
      }

      setSelectedFile(
        null
      );

      setUploadedResult(
        currentImageId ||
        currentImageUrl
          ? {
              imageId:
                currentImageId,

              imageUrl:
                currentImageUrl,
            }
          : null
      );

      setPreviewUrl(
        getPreviewUrl(
          currentImageId,
          currentImageUrl
        )
      );

      setDragging(
        false
      );

      setUploading(
        false
      );

      setErrorMessage(
        ""
      );

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    },
    [
      currentImageId,
      currentImageUrl,
      open,
    ]
  );

  useEffect(
    () => {
      return () => {
        if (
          previewUrl.startsWith(
            "blob:"
          )
        ) {
          URL.revokeObjectURL(
            previewUrl
          );
        }
      };
    },
    [
      previewUrl,
    ]
  );

  if (
    !open
  ) {
    return null;
  }

  const busy =
    disabled ||
    uploading;

  function selectFile(
    file: File
  ) {
    const validationMessage =
      validateImageFile(
        file
      );

    if (
      validationMessage
    ) {
      setErrorMessage(
        validationMessage
      );

      return;
    }

    if (
      previewUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        previewUrl
      );
    }

    setSelectedFile(
      file
    );

    setUploadedResult(
      null
    );

    setPreviewUrl(
      URL.createObjectURL(
        file
      )
    );

    setErrorMessage(
      ""
    );
  }

  function handleInputChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (
      file
    ) {
      selectFile(
        file
      );
    }
  }

  function handleDrop(
    event:
      DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();

    setDragging(
      false
    );

    if (
      busy
    ) {
      return;
    }

    const file =
      event.dataTransfer.files?.[0];

    if (
      !file
    ) {
      setErrorMessage(
        "Không tìm thấy hình ảnh được thả."
      );

      return;
    }

    selectFile(
      file
    );
  }

  async function handleUpload() {
    if (
      !selectedFile ||
      busy
    ) {
      return;
    }

    setUploading(
      true
    );

    setErrorMessage(
      ""
    );

    try {
      const result =
        await onUpload(
          selectedFile
        );

      setUploadedResult(
        result
      );

      setPreviewUrl(
        getPreviewUrl(
          result.imageId,
          result.imageUrl
        )
      );
    } catch (
      error: unknown
    ) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải hình ảnh lên."
      );
    } finally {
      setUploading(
        false
      );
    }
  }

  function handleConfirm() {
    if (
      !uploadedResult
    ) {
      setErrorMessage(
        "Vui lòng tải hình ảnh lên trước."
      );

      return;
    }

    onConfirm(
      uploadedResult
    );

    onClose();
  }

  function handleRemoveFile() {
    if (
      previewUrl.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        previewUrl
      );
    }

    setSelectedFile(
      null
    );

    setUploadedResult(
      null
    );

    setPreviewUrl(
      ""
    );

    setErrorMessage(
      ""
    );

    if (
      inputRef.current
    ) {
      inputRef.current.value =
        "";
    }
  }

  return (
    <div
      className={
        styles.overlay
      }
      role="presentation"
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <section
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-image-upload-title"
      >
        <header
          className={
            styles.header
          }
        >
          <div>
            <h2
              id="question-image-upload-title"
              className={
                styles.title
              }
            >
              {title}
            </h2>

            <p
              className={
                styles.description
              }
            >
              {description}
            </p>
          </div>

          <button
            type="button"
            className={
              styles.closeButton
            }
            disabled={
              busy
            }
            onClick={
              onClose
            }
            aria-label="Đóng"
          >
            ×
          </button>
        </header>

        <div
          className={
            styles.body
          }
        >
          <div
            className={[
              styles.dropZone,

              dragging
                ? styles.dropZoneActive
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDragOver={(
              event
            ) => {
              event.preventDefault();

              if (
                !busy
              ) {
                setDragging(
                  true
                );
              }
            }}
            onDragLeave={(
              event
            ) => {
              event.preventDefault();

              setDragging(
                false
              );
            }}
            onDrop={
              handleDrop
            }
          >
            <span
              className={
                styles.uploadIcon
              }
              aria-hidden="true"
            >
              ↑
            </span>

            <strong>
              Kéo thả hình ảnh vào đây
            </strong>

            <span>
              hoặc
            </span>

            <Button
              type="button"
              variant="outline"
              disabled={
                busy
              }
              onClick={
                () =>
                  inputRef.current?.click()
              }
            >
              Chọn hình ảnh
            </Button>

            <small>
              JPG, PNG hoặc WEBP, tối đa
              5 MB
            </small>

            <input
              ref={
                inputRef
              }
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={
                busy
              }
              onChange={
                handleInputChange
              }
            />
          </div>

          {selectedFile ? (
            <div
              className={
                styles.fileRow
              }
            >
              <div>
                <strong>
                  {
                    selectedFile.name
                  }
                </strong>

                <span>
                  {(
                    selectedFile.size /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB
                </span>
              </div>

              <button
                type="button"
                className={
                  styles.removeButton
                }
                disabled={
                  busy
                }
                onClick={
                  handleRemoveFile
                }
              >
                Xóa
              </button>
            </div>
          ) : null}

          {previewUrl ? (
            <div
              className={
                styles.preview
              }
            >
              <img
                src={
                  previewUrl
                }
                alt="Xem trước hình ảnh"
              />
            </div>
          ) : null}

          {errorMessage ? (
            <p
              className={
                styles.error
              }
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer
          className={
            styles.footer
          }
        >
          <Button
            type="button"
            variant="outline"
            disabled={
              busy
            }
            onClick={
              onClose
            }
          >
            Hủy
          </Button>

          {selectedFile &&
          !uploadedResult ? (
            <Button
              type="button"
              disabled={
                busy
              }
              onClick={
                handleUpload
              }
            >
              {uploading
                ? "Đang tải..."
                : "Tải hình ảnh"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={
                busy ||
                !uploadedResult
              }
              onClick={
                handleConfirm
              }
            >
              Sử dụng hình ảnh
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}
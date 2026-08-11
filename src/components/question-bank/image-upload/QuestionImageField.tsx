"use client";

import {
  useState,
} from "react";

import {
  Button,
} from "@/components/ui";

import QuestionImageUploadModal from "./QuestionImageUploadModal";

import type {
  QuestionImageUploadHandler,
  QuestionImageUploadResult,
} from "./types";

import styles from "./QuestionImageField.module.css";

export type QuestionImageFieldProps = {
  imageId?: string;
  imageUrl?: string;

  disabled?: boolean;

  onUpload:
    QuestionImageUploadHandler;

  onChange: (
    result:
      QuestionImageUploadResult
  ) => void;

  onRemove: () => void;
};

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

export default function QuestionImageField({
  imageId = "",
  imageUrl = "",

  disabled = false,

  onUpload,
  onChange,
  onRemove,
}: QuestionImageFieldProps) {
  const [
    uploadModalOpen,
    setUploadModalOpen,
  ] =
    useState(false);

  const [
    previewFailed,
    setPreviewFailed,
  ] =
    useState(false);

  const previewUrl =
    getPreviewUrl(
      imageId,
      imageUrl
    );

  const hasImage =
    Boolean(
      previewUrl
    );

  return (
    <>
      <section
        className={
          styles.field
        }
      >
        <div
          className={
            styles.header
          }
        >
          <div>
            <h3
              className={
                styles.title
              }
            >
              Hình minh họa
            </h3>

            <p
              className={
                styles.description
              }
            >
              Thêm biểu đồ, sơ đồ hoặc
              hình ảnh liên quan đến câu
              hỏi.
            </p>
          </div>

          <div
            className={
              styles.actions
            }
          >
            {hasImage ? (
              <Button
                type="button"
                variant="outline"
                disabled={
                  disabled
                }
                onClick={
                  onRemove
                }
              >
                Xóa hình
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              disabled={
                disabled
              }
              onClick={
                () => {
                  setPreviewFailed(
                    false
                  );

                  setUploadModalOpen(
                    true
                  );
                }
              }
            >
              {hasImage
                ? "Thay hình"
                : "Thêm hình ảnh"}
            </Button>
          </div>
        </div>

        {hasImage ? (
          <div
            className={
              styles.previewCard
            }
          >
            {!previewFailed ? (
              <img
                key={
                  previewUrl
                }
                src={
                  previewUrl
                }
                alt="Hình minh họa câu hỏi"
                className={
                  styles.previewImage
                }
                referrerPolicy="no-referrer"
                onError={
                  () =>
                    setPreviewFailed(
                      true
                    )
                }
              />
            ) : (
              <div
                className={
                  styles.previewError
                }
                role="alert"
              >
                Không thể hiển thị hình
                ảnh. Hãy thử thay hình
                khác.
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={
              styles.emptyState
            }
            disabled={
              disabled
            }
            onClick={
              () =>
                setUploadModalOpen(
                  true
                )
            }
          >
            <span
              className={
                styles.emptyIcon
              }
              aria-hidden="true"
            >
              +
            </span>

            <strong>
              Chưa có hình minh họa
            </strong>

            <span>
              Nhấn để thêm hình ảnh
            </span>
          </button>
        )}
      </section>

      <QuestionImageUploadModal
        open={
          uploadModalOpen
        }
        currentImageId={
          imageId
        }
        currentImageUrl={
          imageUrl
        }
        disabled={
          disabled
        }
        onUpload={
          onUpload
        }
        onConfirm={(
          result
        ) => {
          setPreviewFailed(
            false
          );

          onChange(
            result
          );
        }}
        onClose={
          () =>
            setUploadModalOpen(
              false
            )
        }
      />
    </>
  );
}
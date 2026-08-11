"use client";

import {
  useMemo,
  useState,
} from "react";

import MathContent from "@/components/common/MathContent";

import type {
  QuestionContentBlock,
  QuestionImageBlock,
  QuestionTableBlock,
} from "@/types/question-content";

import styles from "./QuestionContentBlocks.module.css";

type QuestionContentBlocksProps = {
  content: string;
  blocks?: QuestionContentBlock[];
  questionImageId?: string;
  questionImageUrl?: string;
  className?: string;
};

function resolveImageUrl(
  imageId: string | undefined,
  imageUrl: string
): string {
  const normalizedId =
    imageId?.trim();

  if (normalizedId) {
    return `/api/question-images/${encodeURIComponent(
      normalizedId
    )}`;
  }

  return imageUrl.trim();
}

function ContentImage({
  block,
}: {
  block: QuestionImageBlock;
}) {
  const [failed, setFailed] =
    useState(false);
  const imageUrl =
    useMemo(
      () =>
        resolveImageUrl(
          block.imageId,
          block.imageUrl
        ),
      [
        block.imageId,
        block.imageUrl,
      ]
    );

  if (!imageUrl || failed) {
    return null;
  }

  return (
    <figure
      className={
        styles.imageFigure
      }
    >
      <a
        href={imageUrl}
        target="_blank"
        rel="noreferrer"
        className={
          styles.imageLink
        }
      >
        <img
          src={imageUrl}
          alt={
            block.alt ||
            "Hình minh họa câu hỏi"
          }
          className={
            styles.image
          }
          loading="lazy"
          onError={() =>
            setFailed(true)
          }
        />
      </a>
    </figure>
  );
}

function ContentTable({
  block,
}: {
  block: QuestionTableBlock;
}) {
  const totalWidth =
    block.columnWidths?.reduce(
      (sum, width) =>
        sum + width,
      0
    ) ?? 0;

  return (
    <div
      className={
        styles.tableScroller
      }
    >
      <table
        className={
          styles.table
        }
      >
        {block.columnWidths &&
          totalWidth > 0 && (
          <colgroup>
            {block.columnWidths.map(
              (width, index) => (
                <col
                  key={`${width}-${index}`}
                  style={{
                    width:
                      `${(
                        width /
                        totalWidth
                      ) * 100}%`,
                  }}
                />
              )
            )}
          </colgroup>
        )}

        <tbody>
          {block.rows.map(
            (row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
              >
                {row.cells.map(
                  (
                    cell,
                    cellIndex
                  ) => (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      colSpan={
                        cell.colSpan
                      }
                      rowSpan={
                        cell.rowSpan
                      }
                      style={{
                        textAlign:
                          cell.align,
                        verticalAlign:
                          cell.verticalAlign ===
                          "center"
                            ? "middle"
                            : cell.verticalAlign,
                        fontWeight:
                          cell.bold
                            ? 700
                            : undefined,
                        fontStyle:
                          cell.italic
                            ? "italic"
                            : undefined,
                      }}
                    >
                      <MathContent
                        text={
                          cell.content
                        }
                        className={
                          styles.cellContent
                        }
                      />
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function QuestionContentBlocks({
  content,
  blocks,
  questionImageId,
  questionImageUrl,
  className,
}: QuestionContentBlocksProps) {
  const hasBlocks =
    Boolean(blocks?.length);
  const hasImageBlock =
    blocks?.some(
      (block) =>
        block.type === "image"
    ) ?? false;
  const legacyImageUrl =
    questionImageUrl?.trim() ??
    "";
  const resolvedBlocks:
    QuestionContentBlock[] =
      hasBlocks
        ? [
            ...(blocks ?? []),
          ]
        : [
            {
              type: "text",
              content,
            },
          ];

  if (
    !hasImageBlock &&
    (questionImageId?.trim() ||
      legacyImageUrl)
  ) {
    resolvedBlocks.push({
      type: "image",
      imageId:
        questionImageId,
      imageUrl:
        legacyImageUrl,
    });
  }

  return (
    <div
      className={[
        styles.content,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {resolvedBlocks.map(
        (block, index) => {
          if (
            block.type === "table"
          ) {
            return (
              <ContentTable
                key={`table-${index}`}
                block={block}
              />
            );
          }

          if (
            block.type === "image"
          ) {
            return (
              <ContentImage
                key={`image-${index}`}
                block={block}
              />
            );
          }

          return (
            <MathContent
              key={`text-${index}`}
              text={block.content}
              className={
                styles.text
              }
            />
          );
        }
      )}
    </div>
  );
}

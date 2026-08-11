"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  CSSProperties,
} from "react";

type ExamImageProps = {
  src?: string;

  alt: string;

  variant?:
    | "question"
    | "answer"
    | "statement";

  caption?: string;

  className?: string;
};

export default function ExamImage({
  src,
  alt,
  variant = "question",
  caption,
  className,
}: ExamImageProps) {
  const [
    opened,
    setOpened,
  ] =
    useState(
      false
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    failed,
    setFailed,
  ] =
    useState(
      false
    );

  useEffect(
    () => {
      setOpened(
        false
      );

      setLoading(
        true
      );

      setFailed(
        false
      );
    },
    [
      src,
    ]
  );

  useEffect(
    () => {
      if (
        !opened
      ) {
        return;
      }

      function handleKeyDown(
        event:
          KeyboardEvent
      ) {
        if (
          event.key ===
          "Escape"
        ) {
          setOpened(
            false
          );
        }
      }

      const previousOverflow =
        document.body.style
          .overflow;

      document.body.style.overflow =
        "hidden";

      window.addEventListener(
        "keydown",
        handleKeyDown
      );

      return () => {
        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown
        );
      };
    },
    [
      opened,
    ]
  );

  if (
    !src
  ) {
    return null;
  }

  if (
    failed
  ) {
    return (
      <div
        style={
          errorStyle
        }
      >
        Không tải được hình ảnh.
      </div>
    );
  }

  const imageStyle =
    variant ===
    "question"
      ? questionImageStyle
      : variant ===
          "statement"
        ? statementImageStyle
        : answerImageStyle;

  return (
    <>
      <figure
        className={
          className
        }
        style={
          figureStyle
        }
      >
        <button
          type="button"
          onClick={() => {
            setOpened(
              true
            );
          }}
          style={
            imageButtonStyle
          }
          aria-label={`Phóng to: ${alt}`}
        >
          {loading && (
            <div
              style={
                loadingStyle
              }
            >
              Đang tải hình ảnh...
            </div>
          )}

          <img
            src={
              src
            }
            alt={
              alt
            }
            onLoad={() => {
              setLoading(
                false
              );
            }}
            onError={() => {
              setLoading(
                false
              );

              setFailed(
                true
              );
            }}
            style={{
              ...imageStyle,

              display:
                loading
                  ? "none"
                  : "block",
            }}
          />

          {!loading && (
            <span
              style={
                zoomHintStyle
              }
            >
              ⤢ Bấm để phóng to
            </span>
          )}
        </button>

        {caption && (
          <figcaption
            style={
              captionStyle
            }
          >
            {
              caption
            }
          </figcaption>
        )}
      </figure>

      {opened && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            alt
          }
          style={
            overlayStyle
          }
          onClick={() => {
            setOpened(
              false
            );
          }}
        >
          <div
            style={
              modalStyle
            }
            onClick={(
              event
            ) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpened(
                  false
                );
              }}
              style={
                closeButtonStyle
              }
              aria-label="Đóng hình ảnh"
            >
              ×
            </button>

            <img
              src={
                src
              }
              alt={
                alt
              }
              style={
                modalImageStyle
              }
            />

            {caption && (
              <div
                style={
                  modalCaptionStyle
                }
              >
                {
                  caption
                }
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const figureStyle:
  CSSProperties = {
  margin:
    0,

  width:
    "100%",
};

const imageButtonStyle:
  CSSProperties = {
  position:
    "relative",

  display:
    "block",

  width:
    "100%",

  padding:
    0,

  border:
    "none",

  borderRadius:
    16,

  background:
    "transparent",

  cursor:
    "zoom-in",

  textAlign:
    "left",

  overflow:
    "hidden",
};

const baseImageStyle:
  CSSProperties = {
  width:
    "auto",

  maxWidth:
    "100%",

  objectFit:
    "contain",

  borderRadius:
    16,

  border:
    "1px solid #e2e8f0",

  background:
    "#f8fafc",

  margin:
    "0 auto",
};

const questionImageStyle:
  CSSProperties = {
  ...baseImageStyle,

  maxHeight:
    520,
};

const answerImageStyle:
  CSSProperties = {
  ...baseImageStyle,

  maxHeight:
    260,

  margin:
    "10px 0 0",
};

const statementImageStyle:
  CSSProperties = {
  ...baseImageStyle,

  maxHeight:
    240,

  margin:
    "10px 0 0",
};

const loadingStyle:
  CSSProperties = {
  minHeight:
    130,

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  borderRadius:
    16,

  border:
    "1px solid #e2e8f0",

  background:
    "#f8fafc",

  color:
    "#64748b",

  fontWeight:
    700,
};

const errorStyle:
  CSSProperties = {
  padding:
    14,

  borderRadius:
    14,

  border:
    "1px solid #fecaca",

  background:
    "#fef2f2",

  color:
    "#991b1b",

  fontWeight:
    700,
};

const zoomHintStyle:
  CSSProperties = {
  position:
    "absolute",

  right:
    10,

  bottom:
    10,

  padding:
    "6px 9px",

  borderRadius:
    999,

  background:
    "rgba(15, 23, 42, 0.78)",

  color:
    "white",

  fontSize:
    12,

  fontWeight:
    800,

  pointerEvents:
    "none",
};

const captionStyle:
  CSSProperties = {
  marginTop:
    7,

  textAlign:
    "center",

  color:
    "#64748b",

  fontSize:
    13,

  lineHeight:
    1.5,
};

const overlayStyle:
  CSSProperties = {
  position:
    "fixed",

  inset:
    0,

  zIndex:
    9999,

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  padding:
    24,

  background:
    "rgba(15, 23, 42, 0.88)",

  boxSizing:
    "border-box",
};

const modalStyle:
  CSSProperties = {
  position:
    "relative",

  width:
    "100%",

  maxWidth:
    1200,

  maxHeight:
    "92vh",

  padding:
    18,

  borderRadius:
    20,

  background:
    "white",

  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.35)",

  overflow:
    "auto",

  boxSizing:
    "border-box",
};

const closeButtonStyle:
  CSSProperties = {
  position:
    "sticky",

  top:
    0,

  float:
    "right",

  zIndex:
    2,

  width:
    42,

  height:
    42,

  border:
    "none",

  borderRadius:
    "50%",

  background:
    "#0f172a",

  color:
    "white",

  fontSize:
    28,

  lineHeight:
    1,

  cursor:
    "pointer",
};

const modalImageStyle:
  CSSProperties = {
  display:
    "block",

  width:
    "auto",

  maxWidth:
    "100%",

  maxHeight:
    "80vh",

  objectFit:
    "contain",

  margin:
    "0 auto",

  borderRadius:
    14,
};

const modalCaptionStyle:
  CSSProperties = {
  marginTop:
    12,

  textAlign:
    "center",

  color:
    "#475569",

  fontWeight:
    700,
};
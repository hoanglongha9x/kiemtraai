"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  QuestionImageField,
  uploadQuestionImage,
  type QuestionImageUploadResult,
} from "@/components/question-bank/image-upload";

import {
  useTeacherSettings,
} from "@/features/teacher-settings/hooks";

import {
  auth,
} from "@/lib/firebase/client";

import {
  QuestionBasicFields,
  QuestionAnalysisFields,
  QuestionFormFooter,
  QuestionFormHeader,
  ShortAnswerFields,
  SingleChoiceFields,
  TrueFalseGroupFields,
  createFormValues,
  validateQuestionForm,
} from "./question-form";

import type {
  QuestionFormErrors,
  QuestionFormModalProps,
  QuestionFormValues,
} from "./question-form";

import styles from "./QuestionFormModal.module.css";

export type {
  QuestionFormValues,
} from "./question-form";

export default function QuestionFormModal({
  open,
  question,
  submitting = false,
  defaultType,
  defaultSubject,
  defaultGrade,
  onRequestClose,
  onSubmit,
}: QuestionFormModalProps) {
  const {
    settings: teacherSettings,
    loading: settingsLoading,
  } = useTeacherSettings();

  const modalRef =
    useRef<HTMLElement | null>(null);

  const contentFieldRef =
    useRef<HTMLTextAreaElement | null>(null);

  const initialValues = useMemo(
    () => {
      const baseValues =
        createFormValues(
          question,
          teacherSettings
        );

      if (question) {
        return baseValues;
      }

      return {
        ...baseValues,
        type:
          defaultType ??
          baseValues.type,
        subject:
          defaultSubject ||
          baseValues.subject,
        grade:
          defaultGrade ||
          baseValues.grade,
      };
    },
    [
      defaultGrade,
      defaultSubject,
      defaultType,
      question,
      teacherSettings,
    ]
  );

  const [
    values,
    setValues,
  ] = useState<QuestionFormValues>(
    initialValues
  );

  const [
    errors,
    setErrors,
  ] = useState<QuestionFormErrors>(
    {}
  );

  const formBusy = submitting;

  const hasUnsavedChanges =
    useMemo(
      () =>
        JSON.stringify(values) !==
        JSON.stringify(initialValues),
      [
        initialValues,
        values,
      ]
    );

  const requestClose =
    useCallback(() => {
      if (formBusy) {
        return;
      }

      onRequestClose(
        hasUnsavedChanges
      );
    }, [
      formBusy,
      hasUnsavedChanges,
      onRequestClose,
    ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      initialValues
    );

    setErrors(
      {}
    );
  }, [
    initialValues,
    open,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId =
      window.setTimeout(
        () => {
          contentFieldRef.current?.focus();
        },
        80
      );

    return () => {
      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    open,
    question,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        requestClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    open,
    requestClose,
  ]);

  const updateField =
    useCallback(
      <
        Field extends keyof QuestionFormValues,
      >(
        field: Field,
        value:
          QuestionFormValues[Field]
      ) => {
        setValues(
          currentValues => ({
            ...currentValues,
            [field]: value,
          })
        );

        setErrors(
          currentErrors => {
            if (
              !currentErrors[
                field
              ]
            ) {
              return currentErrors;
            }

            const nextErrors = {
              ...currentErrors,
            };

            delete nextErrors[
              field
            ];

            return nextErrors;
          }
        );
      },
      []
    );

  const handleUploadQuestionImage =
    useCallback(
      async (
        file: File
      ): Promise<QuestionImageUploadResult> => {
        const currentUser =
          auth.currentUser;

        if (!currentUser) {
          throw new Error(
            "Bạn cần đăng nhập để tải ảnh câu hỏi."
          );
        }

        const idToken =
          await currentUser.getIdToken();

        return uploadQuestionImage(
          file,
          {
            questionId:
              question?.id,

            idToken,
          }
        );
      },
      [
        question?.id,
      ]
    );

  const handleQuestionImageChange =
    useCallback(
      (
        result:
          QuestionImageUploadResult
      ) => {
        setValues(
          currentValues => ({
            ...currentValues,

            questionImageId:
              result.imageId,

            questionImageUrl:
              result.imageUrl,

            contentBlocks: [
              ...currentValues
                .contentBlocks
                .filter(
                  (block) =>
                    block.type !==
                    "image"
                ),
              {
                type:
                  "image" as const,
                imageId:
                  result.imageId,
                imageUrl:
                  result.imageUrl,
              },
            ],
          })
        );
      },
      []
    );

  const handleQuestionImageRemove =
    useCallback(() => {
      if (formBusy) {
        return;
      }

      setValues(
        currentValues => ({
          ...currentValues,

          questionImageId:
            "",

            questionImageUrl:
              "",

            contentBlocks:
              currentValues
                .contentBlocks
                .filter(
                  (block) =>
                    block.type !==
                    "image"
                ),
        })
      );
    }, [
      formBusy,
    ]);

  const focusFirstInvalidField =
    useCallback(() => {
      window.requestAnimationFrame(
        () => {
          const firstInvalidField =
            modalRef.current
              ?.querySelector<HTMLElement>(
                `.${styles.invalid}`
              );

          if (
            !firstInvalidField
          ) {
            return;
          }

          firstInvalidField.scrollIntoView({
            behavior:
              "smooth",

            block:
              "center",
          });

          firstInvalidField.focus({
            preventScroll:
              true,
          });
        }
      );
    }, []);

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (formBusy) {
        return;
      }

      const validationErrors =
        validateQuestionForm(
          values
        );

      if (
        Object.keys(
          validationErrors
        ).length > 0
      ) {
        setErrors(
          validationErrors
        );

        focusFirstInvalidField();

        return;
      }

      const submittedValues:
        QuestionFormValues = {
          ...values,

          content:
            values.content.trim(),

          questionImageId:
            values.questionImageId.trim(),

          questionImageUrl:
            values.questionImageUrl.trim(),

          subject:
            values.subject.trim(),

          grade:
            values.grade.trim(),

          topic:
            values.topic.trim(),

          knowledgeUnit:
            values.knowledgeUnit.trim(),

          skill:
            values.skill.trim(),

          learningOutcome:
            values.learningOutcome.trim(),

          tags:
            values.tags.trim(),

          optionA:
            values.optionA.trim(),

          optionB:
            values.optionB.trim(),

          optionC:
            values.optionC.trim(),

          optionD:
            values.optionD.trim(),

          statementA:
            values.statementA.trim(),

          statementB:
            values.statementB.trim(),

          statementC:
            values.statementC.trim(),

          statementD:
            values.statementD.trim(),

          acceptedAnswers:
            values.acceptedAnswers.trim(),

          explanation:
            values.explanation.trim(),
        };

      await onSubmit(
        submittedValues
      );
    };

  if (!open) {
    return null;
  }

  if (
    !question &&
    settingsLoading
  ) {
    return (
      <div
        className={
          styles.overlay
        }
        role="presentation"
      >
        <section
          className={
            styles.loadingModal
          }
          role="dialog"
          aria-modal="true"
          aria-label="Đang chuẩn bị biểu mẫu"
        >
          <span
            className={
              styles.loadingSpinner
            }
            aria-hidden="true"
          />

          <strong>
            Đang chuẩn bị biểu mẫu
          </strong>

          <p>
            Hệ thống đang tải các thiết lập
            mặc định của giáo viên.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div
      className={
        styles.overlay
      }
      role="presentation"
      onMouseDown={event => {
        if (
          event.target ===
          event.currentTarget
        ) {
          requestClose();
        }
      }}
    >
      <section
        ref={
          modalRef
        }
        className={
          styles.modal
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-form-title"
        aria-describedby="question-form-description"
      >
        <QuestionFormHeader
          editing={
            Boolean(
              question
            )
          }
          disabled={
            formBusy
          }
          onClose={
            requestClose
          }
        />

        <form
          className={
            styles.form
          }
          noValidate
          onSubmit={
            handleSubmit
          }
        >
          <div
            className={
              styles.body
            }
          >
            <QuestionBasicFields
              values={
                values
              }
              errors={
                errors
              }
              disabled={
                formBusy
              }
              contentFieldRef={
                contentFieldRef
              }
              onUpdateField={
                updateField
              }
            />

            <QuestionImageField
              imageId={
                values.questionImageId
              }
              imageUrl={
                values.questionImageUrl
              }
              disabled={
                formBusy
              }
              onUpload={
                handleUploadQuestionImage
              }
              onChange={
                handleQuestionImageChange
              }
              onRemove={
                handleQuestionImageRemove
              }
            />

            <QuestionAnalysisFields
              values={values}
              errors={errors}
              disabled={formBusy}
              onUpdateField={updateField}
            />

            {values.type ===
            "single_choice" ? (
              <SingleChoiceFields
                values={
                  values
                }
                errors={
                  errors
                }
                disabled={
                  formBusy
                }
                onUpdateField={
                  updateField
                }
              />
            ) : null}

            {values.type ===
            "true_false_group" ? (
              <TrueFalseGroupFields
                values={
                  values
                }
                errors={
                  errors
                }
                disabled={
                  formBusy
                }
                onUpdateField={
                  updateField
                }
              />
            ) : null}

            {values.type ===
            "short_answer" ? (
              <ShortAnswerFields
                values={
                  values
                }
                errors={
                  errors
                }
                disabled={
                  formBusy
                }
                onUpdateField={
                  updateField
                }
              />
            ) : null}
          </div>

          <QuestionFormFooter
            editing={
              Boolean(
                question
              )
            }
            submitting={
              submitting
            }
            disabled={
              formBusy
            }
            onCancel={
              requestClose
            }
          />
        </form>
      </section>
    </div>
  );
}

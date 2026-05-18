import { useEffect, useRef, useState } from "react";
import API from "../services/api";

const DEFAULT_TITLE = "Pothole report";

const buildTitle = (note) => {
  const cleanedNote = note.trim().replace(/\s+/g, " ");

  if (!cleanedNote) {
    return DEFAULT_TITLE;
  }

  const summary = cleanedNote.split(" ").slice(0, 8).join(" ");
  const title = summary;

  return title.length > 100 ? `${title.slice(0, 97)}...` : title;
};

const buildReference = (report) => {
  if (!report?._id) {
    return "pending";
  }

  return `RS-${report._id.slice(-6).toUpperCase()}`;
};

function ReportForm({ mode = "page", onSubmitted }) {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [hasAttemptedAutoLocation, setHasAttemptedAutoLocation] = useState(false);
  const [note, setNote] = useState("");
  const [submittedReport, setSubmittedReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);
  const isModal = mode === "modal";

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (
      !image ||
      location ||
      locLoading ||
      hasAttemptedAutoLocation ||
      !navigator.geolocation
    ) {
      return;
    }

    setHasAttemptedAutoLocation(true);
    getLocation(true);
  }, [image, location, locLoading]);

  const step = preview ? (location || note.trim() ? 3 : 2) : 1;
  const isSubmitDisabled = !image || !note.trim() || submitting;

  const handleFile = (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImage(file);
    setPreview(URL.createObjectURL(file));
    setErrorMessage("");
  };

  const getLocation = (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) {
        setErrorMessage("Location is not supported in this browser.");
      }
      return;
    }

    setLocLoading(true);
    if (!silent) {
      setErrorMessage("");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      (err) => {
        let message =
          "We could not detect your location. You can still submit if the image contains GPS data.";

        if (err.code === 1) {
          message =
            "Location permission was denied. You can still submit if the photo contains GPS data.";
        } else if (err.code === 2) {
          message =
            "Your location is unavailable right now. You can still submit if the photo contains GPS data.";
        }

        if (!silent) {
          setErrorMessage(message);
        }
        setLocLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async () => {
    const trimmedNote = note.trim();

    if (!image) {
      setErrorMessage("Please upload a photo before submitting.");
      return;
    }

    if (!trimmedNote) {
      setErrorMessage("Please add a short note about the pothole.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("image", image);
    formData.append("title", buildTitle(trimmedNote));
    formData.append("description", trimmedNote);

    if (location) {
      formData.append("latitude", String(location.lat));
      formData.append("longitude", String(location.lng));
      formData.append("locationSource", "browser");
    }

    try {
      const res = await API.post("/reports", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSubmittedReport(res.data.data);
      onSubmitted?.(res.data.data);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error ||
          "Error submitting report. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setImage(null);
    setPreview(null);
    setLocation(null);
    setHasAttemptedAutoLocation(false);
    setNote("");
    setSubmittedReport(null);
    setSubmitting(false);
    setErrorMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const pageStyles = isModal ? s.modalPage : s.page;
  const cardStyles = {
    ...s.card,
    ...(isModal ? s.modalCard : {}),
  };

  if (submittedReport) {
    return (
      <div style={pageStyles}>
        <div style={cardStyles}>
          <div style={s.success}>
            <div style={s.checkRing}>
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#085041"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={s.successTitle}>Report submitted</p>
            <p style={s.successSub}>
              Your local civic team has been notified.{"\n"}Thank you for
              helping!
            </p>
            <p style={s.sourcePill}>
              GPS source: {submittedReport.locationSource || "unknown"}
            </p>
            <div style={s.refPill}>ref #{buildReference(submittedReport)}</div>
            <button style={s.resetBtn} onClick={reset}>
              report another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyles}>
      <div style={cardStyles}>
        <div style={s.header}>
          <p style={s.headerLabel}>civic report</p>
          <p style={s.headerTitle}>Report a pothole</p>
          <div style={s.dotsRow}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ ...s.dot, ...(step >= n ? s.dotOn : {}) }} />
            ))}
          </div>
        </div>

        <div
          style={{
            ...s.dropZone,
            ...(dragOver ? s.dropDrag : {}),
            ...(preview ? s.dropFilled : {}),
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          {preview ? (
            <img src={preview} alt="pothole preview" style={s.previewImg} />
          ) : (
            <div style={s.placeholder}>
              <div style={s.iconCircle}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#085041"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <p style={s.uploadText}>tap to upload a photo</p>
              <p style={s.uploadSub}>or drag and drop</p>
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        <div style={s.row}>
          <div
            style={{ ...s.locRow, ...(location ? s.locDone : {}) }}
            onClick={!location ? getLocation : undefined}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#085041"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            <span style={s.locText}>
              {locLoading
                ? "detecting..."
                : location
                  ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : hasAttemptedAutoLocation
                    ? "auto-detecting unavailable"
                    : "use my location"}
            </span>
            {location && <span style={s.locBadge}>detected</span>}
          </div>
          <p style={s.helperText}>
            {location
              ? "Browser GPS was captured automatically and will be sent with this report."
              : "We will auto-try browser GPS first, then fall back to GPS embedded in the photo when available."}
          </p>
        </div>

        <div style={s.row}>
          <textarea
            style={s.note}
            rows={2}
            placeholder="add a note (Required)"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);

              if (errorMessage) {
                setErrorMessage("");
              }
            }}
          />
        </div>

        {errorMessage ? (
          <div style={s.row}>
            <p style={s.errorText}>{errorMessage}</p>
          </div>
        ) : null}

        <div style={s.divider} />
        <div style={{ ...s.row, paddingBottom: "1.25rem" }}>
          <button
            style={{ ...s.submitBtn, ...(isSubmitDisabled ? s.submitOff : {}) }}
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
          >
            {submitting ? "submitting..." : "submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    height: "100vh",
    width: "100vw",
    background: "#E1F5EE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: "1.25rem",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  modalPage: {
    width: "100%",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: 0,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    maxHeight: "calc(100vh - 2.5rem)",
    background: "#F2FBF7",
    borderRadius: "24px",
    border: "0.5px solid #9FE1CB",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  modalCard: {
    maxWidth: "440px",
    maxHeight: "calc(100vh - 88px)",
    boxShadow: "0 28px 64px rgba(10, 44, 37, 0.18)",
  },
  header: {
    background: "#0F6E56",
    padding: "1.1rem 1.4rem 0.9rem",
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: "10px",
    color: "#9FE1CB",
    margin: "0 0 2px",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: "21px",
    fontWeight: "500",
    margin: 0,
    color: "#E1F5EE",
  },
  dotsRow: {
    display: "flex",
    gap: "5px",
    paddingTop: "0.55rem",
  },
  dot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#1D9E75",
    transition: "background 0.3s",
  },
  dotOn: {
    background: "#9FE1CB",
  },
  dropZone: {
    border: "1.5px dashed #1D9E75",
    borderRadius: "12px",
    margin: "0.9rem 1.1rem 0",
    flex: "1 1 auto",
    minHeight: "100px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    background: "#E1F5EE",
    overflow: "hidden",
    transition: "border-color 0.2s, background 0.2s",
  },
  dropDrag: {
    borderColor: "#0F6E56",
    background: "#C8EDDF",
  },
  dropFilled: {
    borderStyle: "solid",
    borderColor: "#9FE1CB",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "10px",
    display: "block",
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  iconCircle: {
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "#9FE1CB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    fontSize: "13px",
    color: "#0F6E56",
    margin: 0,
    fontWeight: "500",
  },
  uploadSub: {
    fontSize: "11px",
    color: "#5DCAA5",
    margin: 0,
  },
  row: {
    margin: "0.7rem 1.1rem 0",
    flexShrink: 0,
  },
  locRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#9FE1CB",
    borderRadius: "10px",
    padding: "9px 13px",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  locDone: {
    background: "#5DCAA5",
    cursor: "default",
  },
  locText: {
    fontSize: "13px",
    color: "#085041",
    flex: 1,
  },
  locBadge: {
    fontSize: "11px",
    background: "#0F6E56",
    color: "#9FE1CB",
    padding: "2px 8px",
    borderRadius: "20px",
    fontWeight: "500",
  },
  helperText: {
    marginTop: "0.45rem",
    fontSize: "11px",
    color: "#2D8A6D",
    lineHeight: "1.5",
    textAlign: "left",
  },
  note: {
    width: "100%",
    boxSizing: "border-box",
    resize: "none",
    border: "1px solid #9FE1CB",
    borderRadius: "10px",
    padding: "9px 12px",
    fontSize: "13px",
    fontFamily: "inherit",
    color: "#085041",
    background: "#E1F5EE",
    outline: "none",
    lineHeight: "1.5",
  },
  errorText: {
    fontSize: "12px",
    color: "#B42318",
    textAlign: "left",
    lineHeight: "1.5",
  },
  divider: {
    height: "0.5px",
    background: "#9FE1CB",
    margin: "0.75rem 1.1rem 0",
    flexShrink: 0,
  },
  submitBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "none",
    background: "#0F6E56",
    color: "#E1F5EE",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    transition: "background 0.15s",
  },
  submitOff: {
    background: "#9FE1CB",
    cursor: "not-allowed",
    color: "#5DCAA5",
  },
  success: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    padding: "2.5rem 2rem",
    textAlign: "center",
  },
  checkRing: {
    width: "58px",
    height: "58px",
    borderRadius: "50%",
    background: "#9FE1CB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "1.1rem",
  },
  successTitle: {
    fontSize: "21px",
    fontWeight: "500",
    margin: "0 0 6px",
    color: "#085041",
  },
  successSub: {
    fontSize: "13px",
    color: "#0F6E56",
    margin: 0,
    lineHeight: "1.7",
    whiteSpace: "pre-line",
  },
  refPill: {
    fontSize: "11px",
    color: "#0F6E56",
    background: "#9FE1CB",
    padding: "5px 14px",
    borderRadius: "20px",
    marginTop: "0.9rem",
    fontWeight: "500",
  },
  sourcePill: {
    marginTop: "0.75rem",
    marginBottom: 0,
    fontSize: "11px",
    color: "#0F6E56",
    background: "#E1F5EE",
    padding: "5px 14px",
    borderRadius: "20px",
    fontWeight: "500",
  },
  resetBtn: {
    marginTop: "1.25rem",
    padding: "9px 22px",
    border: "1px solid #9FE1CB",
    borderRadius: "10px",
    background: "transparent",
    color: "#0F6E56",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
};

export default ReportForm;

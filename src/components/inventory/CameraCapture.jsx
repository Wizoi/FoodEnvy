// Lets the user attach a photo to an inventory item. This is intentionally a
// stub for now: it just captures and stores the image, it does not run any
// recognition on it. The name/quantity fields are still filled in by hand.
// A future vision integration (e.g. auto-populating items from the photo)
// would plug in here, replacing the manual form fields with suggestions
// derived from the captured image.
export default function CameraCapture({ photoDataUrl, onCapture }) {
  function handleChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div className="camera-capture">
      {photoDataUrl && <img src={photoDataUrl} alt="" className="camera-capture-preview" />}
      <label className="camera-capture-input">
        {photoDataUrl ? 'Retake photo' : 'Add photo'}
        <input type="file" accept="image/*" capture="environment" onChange={handleChange} hidden />
      </label>
    </div>
  );
}

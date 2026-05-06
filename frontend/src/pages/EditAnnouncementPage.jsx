import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Select from 'react-select';
import {
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
} from '../api/announcements';

const CATEGORY_OPTIONS = [
  'City',
  'Community events',
  'Crime & Safety',
  'Culture',
  'Discounts & Benefits',
  'Emergencies',
  'For Seniors',
  'Health',
  'Kids & Family',
].map((c) => ({ value: c, label: c }));

/** Parse ISO string → MM/DD/YYYY HH:mm */
function isoToDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

/** Parse MM/DD/YYYY HH:mm → ISO string */
function displayToIso(str) {
  // str: "MM/DD/YYYY HH:mm"
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, min] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;

export default function EditAnnouncementPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categories, setCategories] = useState([]);
  const [pubDate, setPubDate] = useState('');

  /** Auto-insert separators as the user types digits (MM/DD/YYYY HH:mm) */
  function handlePubDateChange(e) {
    const raw = e.target.value;
    // Allow the user to backspace freely: if they deleted a separator char,
    // also remove the digit before it so they're not stuck.
    const prev = pubDate;
    let val = raw;

    // Strip everything that is not a digit
    const digits = val.replace(/\D/g, '');

    // Rebuild the formatted string from digits
    let formatted = '';
    if (digits.length >= 1) formatted = digits.slice(0, 2);          // MM
    if (digits.length >= 3) formatted += '/' + digits.slice(2, 4);   // /DD
    if (digits.length >= 5) formatted += '/' + digits.slice(4, 8);   // /YYYY
    if (digits.length >= 9) formatted += ' ' + digits.slice(8, 10);  // <space>HH
    if (digits.length >= 11) formatted += ':' + digits.slice(10, 12); // :mm

    // Cap at 16 chars (MM/DD/YYYY HH:mm)
    setPubDate(formatted.slice(0, 16));
  }
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Load existing announcement
  useEffect(() => {
    if (isNew) return;
    getAnnouncement(id)
      .then((ann) => {
        setTitle(ann.title);
        setBody(ann.body);
        setCategories(ann.categories.map((c) => ({ value: c, label: c })));
        setPubDate(isoToDisplay(ann.publication_date));
      })
      .catch(() => setLoadError('Could not load the announcement.'));
  }, [id, isNew]);

  function validate() {
    const errors = {};
    if (!title.trim()) errors.title = 'Title is required.';
    if (!body.trim()) errors.body = 'Content is required.';
    if (categories.length === 0) errors.categories = 'At least one category is required.';
    if (!pubDate.trim()) {
      errors.pubDate = 'Publication date is required.';
    } else if (!DATE_REGEX.test(pubDate.trim())) {
      errors.pubDate = 'Date must be in format MM/DD/YYYY HH:mm (e.g. 08/19/2023 08:55).';
    } else if (!displayToIso(pubDate.trim())) {
      errors.pubDate = 'Invalid date value.';
    }
    return errors;
  }

  async function handlePublish() {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const messages = Object.values(errors).join('\n');
      alert(`Please fix the following errors:\n\n${messages}`);
      return;
    }
    setFieldErrors({});

    const payload = {
      title: title.trim(),
      body: body.trim(),
      publication_date: displayToIso(pubDate.trim()),
      categories: categories.map((c) => c.value),
    };

    setSubmitting(true);
    try {
      if (isNew) {
        await createAnnouncement(payload);
      } else {
        await updateAnnouncement(id, payload);
      }
      navigate('/announcements');
    } catch (err) {
      alert('An error occurred while saving. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pageTitle = isNew ? 'Add new announcement' : 'Edit the announcement';

  return (
    <div className="page-body">
      <div className="form-card">
        <h1 className="form-title">{pageTitle}</h1>

        {loadError && <div className="error-banner">{loadError}</div>}

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="field-title">Title</label>
          <input
            id="field-title"
            type="text"
            className={`form-input${fieldErrors.title ? ' error' : ''}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter announcement title"
          />
          {fieldErrors.title && (
            <div style={{ color: '#e53935', fontSize: 12, marginTop: 4 }}>{fieldErrors.title}</div>
          )}
        </div>

        {/* Content */}
        <div className="form-group">
          <label className="form-label" htmlFor="field-body">Content</label>
          <textarea
            id="field-body"
            className={`form-input form-textarea${fieldErrors.body ? ' error' : ''}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter announcement content"
          />
          {fieldErrors.body && (
            <div style={{ color: '#e53935', fontSize: 12, marginTop: 4 }}>{fieldErrors.body}</div>
          )}
        </div>

        {/* Categories */}
        <div className="form-group">
          <label className="form-label">Category</label>
          <p className="form-label-hint">Select category so readers know what your announcement is about.</p>
          <Select
            inputId="field-categories"
            isMulti
            options={CATEGORY_OPTIONS}
            value={categories}
            onChange={(selected) => setCategories(selected || [])}
            placeholder="Select categories…"
            classNamePrefix="rs"
            styles={{
              control: (base, state) => ({
                ...base,
                borderColor: fieldErrors.categories ? '#e53935' : (state.isFocused ? '#f5a623' : '#ddd'),
                boxShadow: state.isFocused ? '0 0 0 3px rgba(245,166,35,0.12)' : 'none',
                fontFamily: 'Lato, sans-serif',
                fontSize: 13,
                '&:hover': { borderColor: '#f5a623' },
              }),
              multiValue: (base) => ({ ...base, background: '#f0f0f0', borderRadius: 10 }),
              option: (base, state) => ({
                ...base,
                fontSize: 13,
                background: state.isSelected ? '#f5a623' : state.isFocused ? '#fff9c4' : 'white',
                color: state.isSelected ? '#fff' : '#333',
              }),
            }}
          />
          {fieldErrors.categories && (
            <div style={{ color: '#e53935', fontSize: 12, marginTop: 4 }}>{fieldErrors.categories}</div>
          )}
        </div>

        {/* Publication date */}
        <div className="form-group">
          <label className="form-label" htmlFor="field-pubdate">Publication date</label>
          <input
            id="field-pubdate"
            type="text"
            className={`form-input${fieldErrors.pubDate ? ' error' : ''}`}
            value={pubDate}
            onChange={handlePubDateChange}
            placeholder="MM/DD/YYYY HH:mm"
            maxLength={16}
            inputMode="numeric"
          />
          {fieldErrors.pubDate ? (
            <div style={{ color: '#e53935', fontSize: 12, marginTop: 4 }}>{fieldErrors.pubDate}</div>
          ) : (
            <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Format: MM/DD/YYYY HH:mm</div>
          )}
        </div>

        {/* Actions */}
        <div className="form-actions">
          <Link to="/announcements" className="btn-cancel">Cancel</Link>
          <button
            id="btn-publish"
            className="btn-publish"
            onClick={handlePublish}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

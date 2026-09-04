import { GTM_SETUP_LESSONS } from '../utils/gtmSetupCourse'

export function GtmSetupChecklist({ activeLessonId, completedLessons, onSelectLesson }) {
  const completedCount = completedLessons.size
  const percentage = Math.round((completedCount / GTM_SETUP_LESSONS.length) * 100)

  return <div className="setup-course-checklist">
    <div className="setup-course-header">
      <span>Guided setup</span>
      <strong>GTM + GA4 course</strong>
      <div><span>{completedCount}/{GTM_SETUP_LESSONS.length} complete</span><b>{percentage}%</b></div>
      <i aria-hidden="true"><b style={{ width: `${percentage}%` }} /></i>
    </div>
    <ol>
      {GTM_SETUP_LESSONS.map((lesson, index) => {
        const isComplete = completedLessons.has(lesson.id)
        const isActive = lesson.id === activeLessonId
        return <li key={lesson.id}>
          <button type="button" className={`${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`} aria-label={`Lesson ${index + 1}: ${lesson.title}${isComplete ? ', complete' : ''}`} aria-current={isActive ? 'step' : undefined} onClick={() => onSelectLesson(lesson.id)}>
            <span>{isComplete ? '✓' : index + 1}</span>
            <span><small>{lesson.phase}</small><strong>{lesson.shortTitle}</strong></span>
          </button>
        </li>
      })}
    </ol>
  </div>
}

export function GtmSetupLesson({ lesson, lessonIndex, values, completedLessons, notice, onChange, onToggleComplete, onSelectLesson }) {
  const isComplete = completedLessons.has(lesson.id)
  const value = values[lesson.field.key] || ''
  const progressText = `${lessonIndex + 1} of ${GTM_SETUP_LESSONS.length}`
  const previous = GTM_SETUP_LESSONS[lessonIndex - 1]
  const next = GTM_SETUP_LESSONS[lessonIndex + 1]

  return <div className="setup-lesson" role="tabpanel" aria-labelledby={`setup-lesson-${lesson.id}`}>
    <div className="setup-lesson-map" aria-label={`Course position: lesson ${progressText}`}>
      {GTM_SETUP_LESSONS.map((item, index) => <button
        type="button"
        key={item.id}
        title={`${index + 1}. ${item.title}`}
        aria-label={`Lesson ${index + 1}: ${item.title}${completedLessons.has(item.id) ? ', complete' : ''}`}
        className={`${item.id === lesson.id ? 'is-current' : ''} ${completedLessons.has(item.id) ? 'is-complete' : ''}`}
        onClick={() => onSelectLesson(item.id)}
      ><span>{completedLessons.has(item.id) ? '✓' : index + 1}</span></button>)}
    </div>

    <div className="setup-lesson-heading">
      <div><span>{lesson.phase} · Lesson {progressText}</span><h3 id={`setup-lesson-${lesson.id}`}>{lesson.title}</h3></div>
      {isComplete && <b>Complete</b>}
    </div>

    <p className="setup-lesson-why"><strong>Why this matters</strong>{lesson.why}</p>

    <div className="setup-menu-path" aria-label="Menu path">
      <span>Click path</span>
      <ol>{lesson.menu.map((item) => <li key={item}>{item}</li>)}</ol>
    </div>

    <ol className="setup-action-list">
      {lesson.actions.map((action, index) => <li key={action}><span>{index + 1}</span><p>{action}</p></li>)}
    </ol>

    <label className="setup-checkpoint" htmlFor={`setup-field-${lesson.id}`}>
      <span>Lesson checkpoint</span>
      <strong>{lesson.field.label}</strong>
      <input
        id={`setup-field-${lesson.id}`}
        type={lesson.field.type === 'url' ? 'url' : 'text'}
        value={value}
        placeholder={lesson.field.placeholder}
        autoComplete="off"
        spellCheck="false"
        onChange={(event) => onChange(lesson.field.key, lesson.field.transform === 'upper' ? event.target.value.toUpperCase() : event.target.value)}
      />
    </label>

    {notice && <p className={`setup-lesson-notice ${notice.type === 'success' ? 'is-success' : 'is-error'}`} role="status">{notice.message}</p>}

    <details className="setup-common-errors">
      <summary>Common errors to avoid</summary>
      <ul>{lesson.errors.map((error) => <li key={error}>{error}</li>)}</ul>
    </details>

    <div className="setup-lesson-actions">
      <a href={lesson.source} target="_blank" rel="noreferrer">Official instructions ↗</a>
      <button type="button" className={isComplete ? 'is-complete' : ''} onClick={() => onToggleComplete(lesson)}>{isComplete ? 'Mark incomplete' : 'Mark complete'}</button>
    </div>

    <div className="setup-lesson-navigation">
      <button type="button" disabled={!previous} onClick={() => previous && onSelectLesson(previous.id)}>← Previous</button>
      <button type="button" disabled={!next} onClick={() => next && onSelectLesson(next.id)}>Next lesson →</button>
    </div>
  </div>
}

import { describe, expect, test } from 'vitest'
import { GTM_SETUP_LESSONS, createGtmSetupValues, validateGtmSetupLesson } from '../utils/gtmSetupCourse'

describe('guided GTM and GA4 setup course', () => {
  test('defines the complete ten-lesson learning path with current Google tag terminology', () => {
    expect(GTM_SETUP_LESSONS).toHaveLength(10)
    expect(GTM_SETUP_LESSONS.map((lesson) => lesson.title)).toEqual([
      'Create a GA4 property',
      'Create a Web Data Stream',
      'Copy the measurement ID',
      'Create a GTM Web container',
      'Install the GTM snippets',
      'Create a Google tag',
      'Connect the measurement ID',
      'Add the All Pages trigger',
      'Preview with Tag Assistant',
      'Publish the container',
    ])
    expect(GTM_SETUP_LESSONS[5].actions.join(' ')).toMatch(/Google Tag/i)
    expect(GTM_SETUP_LESSONS[7].menu).toContain('Initialization – All Pages')
    expect(GTM_SETUP_LESSONS.every((lesson) => lesson.menu.length > 0 && lesson.actions.length > 0 && lesson.field && lesson.errors.length > 0 && lesson.source.startsWith('https://support.google.com/'))).toBe(true)
  })

  test('distinguishes GTM container IDs from GA4 measurement IDs', () => {
    const values = createGtmSetupValues('GTM-SAFE123')
    const measurementLesson = GTM_SETUP_LESSONS[2]
    const containerLesson = GTM_SETUP_LESSONS[3]

    expect(validateGtmSetupLesson(measurementLesson, { ...values, measurementId: 'GTM-SAFE123' })).toMatch(/begins with G-/i)
    expect(validateGtmSetupLesson(measurementLesson, { ...values, measurementId: 'G-ABC1234567' })).toBe('')
    expect(validateGtmSetupLesson(containerLesson, { ...values, containerId: 'G-ABC1234567' }, 'GTM-SAFE123')).toMatch(/begins with GTM-/i)
    expect(validateGtmSetupLesson(containerLesson, { ...values, containerId: 'GTM-OTHER99' }, 'GTM-SAFE123')).toMatch(/opened for GTM-SAFE123/i)
  })

  test('requires the connected Tag ID to match lesson 3', () => {
    const lesson = GTM_SETUP_LESSONS[6]
    const values = { ...createGtmSetupValues('GTM-SAFE123'), measurementId: 'G-ABC1234567' }
    expect(validateGtmSetupLesson(lesson, { ...values, connectedMeasurementId: 'G-OTHER12345' })).toMatch(/does not match/i)
    expect(validateGtmSetupLesson(lesson, { ...values, connectedMeasurementId: 'G-ABC1234567' })).toBe('')
  })
})

import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './routes/Home'
import Practice from './routes/Practice'
import Study from './routes/Study'
import Stats from './routes/Stats'
import TestScreen from './routes/TestScreen'
import Results from './routes/Results'
import SignIn from './routes/SignIn'
import SignUp from './routes/SignUp'
import ResetPassword from './routes/ResetPassword'
import Account from './routes/Account'
import NotFound from './routes/NotFound'
import StudyPlan from './routes/StudyPlan'
import StudyHub from './routes/StudyHub'
import Learn from './routes/Learn'
import Lesson from './routes/Lesson'
import Mistakes from './routes/Mistakes'
import QuestionLesson from './routes/QuestionLesson'
import Topic from './routes/Topic'
import { useAuth } from './store/auth'

export default function App() {
  const init = useAuth((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <>
      <Routes>
        {/* The test itself sits outside the chrome so the exam is distraction free. */}
        <Route path="/test" element={<TestScreen />} />
        <Route path="/results" element={<Results />} />

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/study" element={<StudyHub />} />
          <Route path="/study/flashcards" element={<Study />} />
          <Route path="/study/learn" element={<Learn />} />
          <Route path="/study/learn/:lessonId" element={<Lesson />} />
          <Route path="/study/question/:questionId" element={<QuestionLesson />} />
          <Route path="/study/topics/:chapterId/:section" element={<Topic />} />
          <Route path="/study/mistakes" element={<Mistakes />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/plan" element={<StudyPlan />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}

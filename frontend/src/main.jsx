import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Home from './pages/home/page.jsx'
import Request from './pages/request/page.jsx'
import Quotation from './pages/quotation/page.jsx'


const pages = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />
      },
      {
        path: "/request",
        element: <Request />
      },
      {
        path: "/quotation",
        element: <Quotation />
      }
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={pages} />
  </StrictMode>,
)

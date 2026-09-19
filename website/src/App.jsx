import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import ProductShowcase from './components/ProductShowcase'
import PrivacySection from './components/PrivacySection'
import DownloadSection from './components/DownloadSection'
import FAQ from './components/FAQ'
import FinalCTA from './components/FinalCTA'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ProductShowcase />
        <PrivacySection />
        <DownloadSection />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
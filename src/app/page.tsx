import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import SectionDivider from "@/components/SectionDivider";
import Benefits from "@/components/Benefits";
import PhoneDemo from "@/components/PhoneDemo";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <StatsBar />
      <SectionDivider />
      <Benefits />
      <SectionDivider />
      <PhoneDemo />
      <Footer />
    </>
  );
}

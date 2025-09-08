export default function HeroSection() {
  return (
    <section 
      className="relative h-96 bg-cover bg-center bg-blue-600"
      style={{
        backgroundImage: `linear-gradient(rgba(30, 58, 138, 0.7), rgba(30, 58, 138, 0.7)), url('https://images.unsplash.com/photo-1707314319121-d183468ef006?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bmRlcndhdGVyJTIwb2NlYW4lMjBibHVlJTIwcmVzZWFyY2h8ZW58MXx8fHwxNzU2NzE1MDU0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-center items-center text-white text-center px-6">
        {/* Main Title with Text Effect */}
        <div className="relative mb-6">
          <h1 className="text-5xl md:text-6xl font-bold mb-2 relative z-10">
            Our Research Ventures
          </h1>
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-20 blur-lg transform scale-110"></div>
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-30 blur-sm"></div>
        </div>

        {/* Flavor Text */}
        <div className="max-w-3xl mb-12">
          <p className="text-xl md:text-2xl mb-3 opacity-90">
            Exploring the depths of marine science and ocean conservation
          </p>
          <p className="text-lg opacity-80">
            Discover groundbreaking research from our world-class scientists advancing our understanding of marine ecosystems, climate change impacts, and sustainable ocean management.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-cyan-300">280+</div>
            <div className="text-sm md:text-base uppercase tracking-wide opacity-90">Researchers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-cyan-300">4,300+</div>
            <div className="text-sm md:text-base uppercase tracking-wide opacity-90">Research Outcomes</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-cyan-300">400+</div>
            <div className="text-sm md:text-base uppercase tracking-wide opacity-90">Grants</div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-8 left-8 w-4 h-4 bg-cyan-400 rounded-full opacity-60 animate-pulse"></div>
      <div className="absolute top-16 right-12 w-2 h-2 bg-blue-300 rounded-full opacity-80"></div>
      <div className="absolute bottom-12 left-16 w-3 h-3 bg-cyan-300 rounded-full opacity-50 animate-pulse"></div>
      <div className="absolute bottom-8 right-8 w-4 h-4 bg-blue-400 rounded-full opacity-70"></div>
    </section>
  );
}
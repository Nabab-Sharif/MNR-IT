const Footer = () => {
  return (
    <footer className="bg-transparent border-t-2 border-primary/40 mt-auto h-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-center text-center">
        <p className="text-foreground text-xs sm:text-sm font-medium leading-tight">
          Created By IT Team
          <span className="text-muted-foreground ml-2">&copy; {new Date().getFullYear()} MNR Group. All rights reserved</span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;

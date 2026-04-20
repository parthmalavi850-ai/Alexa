// Atmospheric UI specific CSS
export const ambientStyles = `
.atmosphere {
  background:
    radial-gradient(circle at 50% 30%, rgba(20, 10, 40, 0.8) 0%, transparent 60%),
    radial-gradient(circle at 10% 80%, rgba(0, 120, 255, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 0, 128, 0.2) 0%, transparent 50%);
  filter: blur(60px);
  opacity: 0.82;
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.glass-panel {
  background: rgba(20, 20, 25, 0.4);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
`;

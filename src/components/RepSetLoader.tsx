import './repset-loader.css';

type RepSetLoaderProps = {
  className?: string;
};

export function RepSetLoader({ className = '' }: RepSetLoaderProps) {
  return (
    <main
      className={`repset-loader ${className}`.trim()}
      role="status"
      aria-label="RepSet is loading"
    >
      <div className="repset-loader__content">
        <div className="repset-loader__logo" aria-hidden="true">
          <div className="repset-loader__drawing">
            <img className="repset-loader__outline" src="/repset-logo-outline.png" alt="" />
          </div>
          <span className="repset-loader__beam" />
        </div>
        <svg className="repset-loader__wordmark" viewBox="0 0 270 82" aria-hidden="true">
          <defs>
            <linearGradient id="repset-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7ec623" />
              <stop offset="0.5" stopColor="#bbff5c" />
              <stop offset="1" stopColor="#f3ffd8" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                from="0 .5 .5"
                to="360 .5 .5"
                dur="3s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          <text x="135" y="59" textAnchor="middle">
            RepSet
          </text>
        </svg>
      </div>
    </main>
  );
}

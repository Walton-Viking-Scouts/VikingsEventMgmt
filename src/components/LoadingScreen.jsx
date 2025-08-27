import React from "react";

function LoadingScreen({ message = "Loading..." }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      data-oid="4iy:2qk"
    >
      <div
        className="w-8 h-8 border-4 border-scout-blue border-t-transparent rounded-full animate-spin mb-4"
        data-oid="r8vi44o"
      ></div>
      <p className="text-gray-600 text-center" data-oid="r:996i3">
        {message}
      </p>
    </div>
  );
}

export default LoadingScreen;

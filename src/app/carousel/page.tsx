"use client"
import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Carousel = () => {
    const PrevArrow: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
      <button
        {...props}
        className="position-absolute top-50 translate-middle-y width-10 height-10 d-flex align-items-center justify-content-center z-index-10"
        style={{ left: "-5%" }}
      >
        <FiChevronLeft />
      </button>
    );
  
    const NextArrow: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
      <button
        {...props}
        className="position-absolute top-50 translate-middle-y width-10 height-10 text-center d-flex align-items-center justify-content-center z-index-10"
        style={{right: "-4%"}}
      >
        <FiChevronRight />
      </button>
    );
  
    const settings = {
      dots: true,
      infinite: true,
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      autoplay: true,
      autoplaySpeed: 5000,
      prevArrow: <PrevArrow />,
      nextArrow: <NextArrow />,
    };
  
    return (
      <>
        <div className="container">
          <h1 className="text-center py-8">Word Search</h1>
          <Slider {...settings}>
            {/* Hardcoded slides */}
            <div className="w-100" style={{height: "100vh"}}>
              <div className="text-center" style={{height: "100vh"}}>
                Slide 1 Content
              </div>
            </div>
  
            <div className="w-100" style={{height: "100vh"}}>
              <div className="text-center" style={{height: "100vh"}}>
                Slide 2 Content
              </div>
            </div>
  
            <div className="w-100" style={{height: "100vh"}}>
              <div className="text-center" style={{height: "100vh"}}>
                Slide 3 Content
              </div>
            </div>
            {/* Add more hardcoded slides as needed */}
          </Slider>
        </div>
      </>
    );
  };

export default Carousel;

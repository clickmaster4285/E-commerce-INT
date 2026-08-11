"use client";

import Link from "next/link";
import {
  Smartphone,
  Laptop,
  Watch,
  Headphones,
  Camera,
  Percent,
} from "lucide-react";


const categories = [

{
name:"Mobiles",
icon:<Smartphone size={28}/>,
link:"/category/mobiles"
},

{
name:"Laptops",
icon:<Laptop size={28}/>,
link:"/category/laptops"
},

{
name:"Smart Watches",
icon:<Watch size={28}/>,
link:"/category/watches"
},

{
name:"Accessories",
icon:<Headphones size={28}/>,
link:"/category/accessories"
},

{
name:"Cameras",
icon:<Camera size={28}/>,
link:"/category/cameras"
},

{
name:"Deals",
icon:<Percent size={28}/>,
link:"/deals"
},


];




export default function CategoryBar(){


return (

<section

className="
bg-[#020d08]
px-5
py-5
"

>


<div

className="
max-w-[1400px]
mx-auto
"

>


<div

className="
flex
items-center
justify-between
mb-4
"

>


<h2

className="
text-white
font-semibold
text-lg
"

>

Shop By Category

</h2>



<Link

href="/categories"

className="
text-[#d4af37]
text-xs
hover:underline
"

>

View All →

</Link>


</div>







<div

className="
grid
grid-cols-2
sm:grid-cols-3
md:grid-cols-6
gap-3
"

>


{

categories.map((category)=>(


<Link

key={category.name}

href={category.link}

className="
group
bg-[#071b12]
border
border-white/5
rounded-xl
p-4
flex
flex-col
items-center
justify-center
gap-3
min-h-[110px]
hover:border-[#d4af37]/50
hover:bg-[#10251a]
transition-all
duration-300
"

>


<div

className="
w-14
h-14
rounded-full
bg-[#10251a]
flex
items-center
justify-center
text-[#d4af37]
group-hover:bg-[#d4af37]
group-hover:text-black
transition
"

>

{category.icon}


</div>




<p

className="
text-xs
text-gray-300
text-center
group-hover:text-white
transition
"

>

{category.name}

</p>



</Link>


))


}



</div>



</div>


</section>

);


}
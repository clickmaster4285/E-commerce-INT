"use client";

import Link from "next/link";


const brands = [

{
name:"Apple",
logo:"",
link:"/brand/apple"
},

{
name:"Samsung",
logo:"S",
link:"/brand/samsung"
},

{
name:"Sony",
logo:"SONY",
link:"/brand/sony"
},

{
name:"Xiaomi",
logo:"MI",
link:"/brand/xiaomi"
},

{
name:"HP",
logo:"HP",
link:"/brand/hp"
},

{
name:"Lenovo",
logo:"L",
link:"/brand/lenovo"
}

];




export default function BrandSection(){


return (

<section

className="
bg-[#020d08]
px-5
py-12
"

>


<div

className="
max-w-[1400px]
mx-auto
"

>


{/* HEADER */}

<div

className="
flex
items-center
justify-between
mb-7
"

>


<h2

className="
text-xl
font-bold
text-white
"

>

Top Brands

</h2>



<Link

href="/brands"

className="
text-sm
text-[#d4af37]
hover:text-yellow-300
"

>

View All →

</Link>


</div>








{/* BRAND CARDS */}


<div

className="
grid
grid-cols-2
sm:grid-cols-3
md:grid-cols-6
gap-4
"

>


{

brands.map((brand)=>(


<Link

href={brand.link}

key={brand.name}

className="
h-28
rounded-xl
bg-[#071b12]
border
border-white/10
flex
flex-col
items-center
justify-center
gap-3
hover:border-[#d4af37]
hover:bg-[#10251a]
transition-all
duration-300
group
"

>



<div

className="
text-3xl
font-black
text-[#d4af37]
group-hover:scale-110
transition
"

>

{brand.logo}


</div>



<p

className="
text-sm
text-gray-300
group-hover:text-white
"

>

{brand.name}

</p>



</Link>


))

}


</div>




</div>


</section>


);


}